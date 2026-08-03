use crate::provider::Provider;
use serde::Serialize;
use serde_json::json;
use std::time::Duration;
use tauri::ipc::Channel;

// Both vendors bill reasoning against the same budget as the visible answer,
// so a Short summary can think itself to empty. Buy headroom.
const REASONING_HEADROOM_TOKENS: u32 = 2048;

// Only the non-streamed call gets a deadline; a stream legitimately stays open
// for minutes and relies on the client's connect timeout instead.
const NON_STREAMED_TIMEOUT: Duration = Duration::from_secs(180);

const ANTHROPIC_URL: &str = "https://api.anthropic.com/v1/messages";
const OPENAI_URL: &str = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Clone, Serialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "metadata")]
    Metadata { title: String, author: String },
    #[serde(rename = "delta")]
    Delta { text: String },
    #[serde(rename = "done")]
    Done,
}

/// A chunk can say three things, not two. Without the middle arm a mid-stream
/// failure is discarded and the user gets a summary that stops mid-sentence.
enum Chunk {
    Text(String),
    Failed(String),
    Ignore,
}

// Decode only up to a character boundary. Decoding each chunk alone would
// mangle any character split across two of them.
fn drain_utf8(bytes: &mut Vec<u8>) -> String {
    let (text, consumed) = match std::str::from_utf8(bytes) {
        Ok(text) => (text.to_string(), bytes.len()),
        Err(error) => {
            let valid = error.valid_up_to();
            let text = String::from_utf8_lossy(&bytes[..valid]).into_owned();
            match error.error_len() {
                // Genuinely malformed: skip it so the stream keeps moving.
                Some(bad) => (text, valid + bad),
                // Just an incomplete tail: keep it for the next chunk.
                None => (text, valid),
            }
        }
    };
    bytes.drain(..consumed);
    text
}

/// Parse SSE lines from a text buffer. Returns remaining unparsed buffer.
fn parse_sse_lines(buffer: &str) -> (Vec<(String, String)>, String) {
    let mut events = Vec::new();
    let mut current_event = String::new();
    let mut current_data = String::new();
    let mut remaining = String::new();

    let lines: Vec<&str> = buffer.split('\n').collect();
    let last_line = lines.last().copied().unwrap_or("");

    // If the buffer doesn't end with \n, the last line is incomplete
    let (complete_lines, leftover) = if buffer.ends_with('\n') {
        (lines.as_slice(), "")
    } else {
        (&lines[..lines.len() - 1], last_line)
    };

    for line in complete_lines {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            // Empty line = end of event
            if !current_data.is_empty() {
                events.push((current_event.clone(), current_data.clone()));
            }
            current_event.clear();
            current_data.clear();
        } else if let Some(value) = line.strip_prefix("event: ") {
            current_event = value.to_string();
        } else if let Some(value) = line.strip_prefix("data: ") {
            current_data = value.to_string();
        } else if line.starts_with("data:") {
            // "data:" with no space after — data is the rest
            current_data = line[5..].to_string();
        }
    }

    // Reconstruct remaining buffer from incomplete data
    if !leftover.is_empty() {
        remaining = leftover.to_string();
    }
    // If we have partial event data that wasn't flushed (no trailing empty line)
    if !current_event.is_empty() || !current_data.is_empty() {
        // Put it back into remaining buffer
        if !current_event.is_empty() {
            remaining = format!("event: {}\n", current_event) + &remaining;
        }
        if !current_data.is_empty() {
            remaining = format!("data: {}\n", current_data) + &remaining;
        }
    }

    (events, remaining)
}

fn parse_anthropic_chunk(data: &str) -> Chunk {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(data) else {
        return Chunk::Ignore;
    };
    match value.get("type").and_then(|t| t.as_str()) {
        Some("content_block_delta") => match value.pointer("/delta/text").and_then(|t| t.as_str()) {
            Some(text) if !text.is_empty() => Chunk::Text(text.to_string()),
            _ => Chunk::Ignore,
        },
        Some("error") => Chunk::Failed(
            value
                .pointer("/error/message")
                .and_then(|m| m.as_str())
                .unwrap_or("The model stopped partway through the summary.")
                .to_string(),
        ),
        _ => Chunk::Ignore,
    }
}

fn parse_openai_chunk(data: &str) -> Chunk {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(data) else {
        return Chunk::Ignore;
    };
    if let Some(message) = value.pointer("/error/message").and_then(|m| m.as_str()) {
        return Chunk::Failed(message.to_string());
    }
    match value
        .pointer("/choices/0/delta/content")
        .and_then(|c| c.as_str())
    {
        Some(text) if !text.is_empty() => Chunk::Text(text.to_string()),
        _ => Chunk::Ignore,
    }
}

/// Everything a summary request needs, minus whether it streams.
pub struct SummaryRequest<'a> {
    pub provider: Provider,
    pub model: &'a str,
    pub system_prompt: &'a str,
    pub transcript: &'a str,
    pub max_tokens: u32,
}

fn request_body(request: &SummaryRequest, stream: bool) -> serde_json::Value {
    let &SummaryRequest {
        provider,
        model,
        system_prompt,
        transcript,
        max_tokens,
    } = request;

    let user_content = format!(
        "Please summarize the following YouTube video transcript:\n\n{}",
        transcript
    );

    // No temperature on either path: current models reject sampling parameters.
    match provider {
        Provider::Anthropic => json!({
            "model": model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{ "role": "user", "content": user_content }],
            "output_config": { "effort": "low" },
            "stream": stream,
        }),
        // OpenAI calls the budget max_completion_tokens, not max_tokens.
        Provider::OpenAI => json!({
            "model": model,
            "max_completion_tokens": max_tokens,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_content },
            ],
            "reasoning_effort": "low",
            "stream": stream,
        }),
    }
}

async fn send(
    client: &reqwest::Client,
    api_key: &str,
    request: &SummaryRequest<'_>,
    stream: bool,
) -> Result<reqwest::Response, String> {
    let provider = request.provider;
    let body = request_body(request, stream);
    let request = match provider {
        Provider::Anthropic => client
            .post(ANTHROPIC_URL)
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION),
        Provider::OpenAI => client
            .post(OPENAI_URL)
            .header("authorization", format!("Bearer {api_key}")),
    };

    let request = if stream {
        request
    } else {
        request.timeout(NON_STREAMED_TIMEOUT)
    };

    request
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Could not reach {}: {e}", provider.label()))
}

/// OpenAI refuses to stream for organisations that have not been ID-verified.
/// The same key works for a single non-streamed response.
fn is_verification_wall(status: u16, body: &str) -> bool {
    let body = body.to_ascii_lowercase();
    (status == 400 || status == 403)
        && body.contains("verif")
        && (body.contains("stream") || body.contains("organization"))
}

fn describe_http_error(provider: Provider, status: u16, body: &str) -> String {
    match status {
        401 => format!(
            "That {} key was rejected. Check it in Settings.",
            provider.label()
        ),
        429 => "Rate limit reached. Wait a moment and try again.".to_string(),
        _ => format!("{} error ({status}): {body}", provider.label()),
    }
}

/// Ask for the whole answer at once. Used when streaming is walled off.
async fn summarize_once(
    client: &reqwest::Client,
    api_key: &str,
    request: &SummaryRequest<'_>,
) -> Result<String, String> {
    let provider = request.provider;
    let response = send(client, api_key, request, false).await?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();
        if provider == Provider::OpenAI && is_verification_wall(status, &body) {
            return Err("Your OpenAI organisation needs to be verified before this model will run. \
                 Verify it at platform.openai.com/settings/organization/general, or pick a Claude model."
                .to_string());
        }
        return Err(describe_http_error(provider, status, &body));
    }

    let value: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Could not read the {} response: {e}", provider.label()))?;

    let text = match provider {
        Provider::Anthropic => value.pointer("/content/0/text").and_then(|t| t.as_str()),
        Provider::OpenAI => value
            .pointer("/choices/0/message/content")
            .and_then(|c| c.as_str()),
    };

    Ok(text.unwrap_or_default().to_string())
}

pub async fn summarize_stream(
    client: &reqwest::Client,
    api_key: &str,
    request: &SummaryRequest<'_>,
    channel: &Channel<StreamEvent>,
) -> Result<String, String> {
    let provider = request.provider;
    let budgeted = SummaryRequest {
        max_tokens: request.max_tokens + REASONING_HEADROOM_TOKENS,
        ..*request
    };
    let response = send(client, api_key, &budgeted, true).await?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let body = response.text().await.unwrap_or_default();

        // One retry, verification wall only. Cannot loop: the retry never retries.
        if provider == Provider::OpenAI && is_verification_wall(status, &body) {
            let summary = summarize_once(client, api_key, &budgeted).await?;
            let summary = reject_if_empty(summary)?;
            let _ = channel.send(StreamEvent::Delta {
                text: summary.clone(),
            });
            return Ok(summary);
        }

        return Err(describe_http_error(provider, status, &body));
    }

    let mut undecoded: Vec<u8> = Vec::new();
    let mut buffer = String::new();
    let mut summary = String::new();
    let mut stream = response;

    while let Some(chunk) = stream
        .chunk()
        .await
        .map_err(|e| format!("The connection dropped mid-summary: {e}"))?
    {
        undecoded.extend_from_slice(&chunk);
        buffer.push_str(&drain_utf8(&mut undecoded));
        let (events, remaining) = parse_sse_lines(&buffer);
        buffer = remaining;

        for (_event_name, data) in events {
            if data == "[DONE]" {
                continue;
            }
            let parsed = match provider {
                Provider::Anthropic => parse_anthropic_chunk(&data),
                Provider::OpenAI => parse_openai_chunk(&data),
            };
            match parsed {
                Chunk::Text(text) => {
                    summary.push_str(&text);
                    let _ = channel.send(StreamEvent::Delta { text });
                }
                Chunk::Failed(message) => return Err(message),
                Chunk::Ignore => {}
            }
        }
    }

    reject_if_empty(summary)
}

/// A run that produced no text is a failure, not a summary. Returning Ok here
/// would cache the blank and replay it for the next 24 hours.
fn reject_if_empty(summary: String) -> Result<String, String> {
    if summary.trim().is_empty() {
        return Err(
            "The model returned an empty summary. Try a longer length, or try again.".to_string(),
        );
    }
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_mid_stream_failure_is_reported_rather_than_silently_dropped() {
        // Anthropic signals an overload partway through with an error event.
        let anthropic = r#"{"type":"error","error":{"message":"Overloaded"}}"#;
        assert!(matches!(parse_anthropic_chunk(anthropic), Chunk::Failed(m) if m == "Overloaded"));

        let openai = r#"{"error":{"message":"server had an error"}}"#;
        assert!(
            matches!(parse_openai_chunk(openai), Chunk::Failed(m) if m == "server had an error")
        );

        // Text still flows, and bookkeeping frames are still ignored.
        let delta = r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}"#;
        assert!(matches!(parse_anthropic_chunk(delta), Chunk::Text(t) if t == "Hi"));
        assert!(matches!(
            parse_anthropic_chunk(r#"{"type":"message_stop"}"#),
            Chunk::Ignore
        ));
        assert!(matches!(
            parse_openai_chunk(r#"{"choices":[{"delta":{}}]}"#),
            Chunk::Ignore
        ));
        assert!(matches!(parse_openai_chunk("not json"), Chunk::Ignore));
    }

    #[test]
    fn the_openai_verification_wall_is_told_apart_from_other_rejections() {
        let wall = r#"{"error":{"message":"Your organization must be verified to stream this model"}}"#;
        assert!(is_verification_wall(400, wall));

        // A bad key or an unknown model must not trigger the non-streamed retry.
        assert!(!is_verification_wall(401, r#"{"error":{"message":"Invalid API key"}}"#));
        assert!(!is_verification_wall(404, r#"{"error":{"message":"model not found"}}"#));
        assert!(!is_verification_wall(200, wall));
    }

    #[test]
    fn requests_omit_temperature_and_use_each_vendors_token_field() {
        let base = SummaryRequest {
            provider: Provider::Anthropic,
            model: "m",
            system_prompt: "sys",
            transcript: "text",
            max_tokens: 3072,
        };

        let anthropic = request_body(&base, true);
        assert!(anthropic.get("temperature").is_none());
        assert_eq!(anthropic["max_tokens"], 3072);

        let openai = request_body(
            &SummaryRequest {
                provider: Provider::OpenAI,
                ..base
            },
            true,
        );
        assert!(openai.get("temperature").is_none());
        assert!(openai.get("max_tokens").is_none());
        assert_eq!(openai["max_completion_tokens"], 3072);
    }

    #[test]
    fn a_character_split_across_chunk_boundaries_survives_reassembly() {
        let source = "data: {\"text\":\"日本語 — café\"}\n";
        let mut undecoded = Vec::new();
        let mut decoded = String::new();

        // One byte at a time is the worst case: every multi-byte character
        // straddles a boundary.
        for byte in source.as_bytes() {
            undecoded.push(*byte);
            decoded.push_str(&drain_utf8(&mut undecoded));
        }

        assert_eq!(decoded, source);
        assert!(undecoded.is_empty());
        assert!(!decoded.contains('\u{FFFD}'));
    }

    #[test]
    fn genuinely_malformed_bytes_are_skipped_rather_than_stalling_the_stream() {
        let mut bytes = vec![0xFF];
        bytes.extend_from_slice(b"ok");

        assert_eq!(drain_utf8(&mut bytes), "");
        assert_eq!(drain_utf8(&mut bytes), "ok");
        assert!(bytes.is_empty());
    }

    #[test]
    fn sse_parsing_carries_a_partial_line_into_the_next_read() {
        // Cut mid-payload: no event yet, and the fragment comes back intact.
        let (events, remaining) = parse_sse_lines("event: x\ndata: {\"a\":1");
        assert!(events.is_empty());

        let (events, remaining) = parse_sse_lines(&format!("{remaining}}}\n\n"));
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].1, r#"{"a":1}"#);
        assert!(remaining.is_empty());
    }

    #[test]
    fn an_empty_summary_is_an_error_so_it_never_reaches_the_cache() {
        assert!(reject_if_empty(String::new()).is_err());
        assert!(reject_if_empty("   \n ".to_string()).is_err());
        assert_eq!(reject_if_empty("real".to_string()).unwrap(), "real");
    }
}
