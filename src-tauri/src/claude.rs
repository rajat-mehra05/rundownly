use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

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

#[derive(Deserialize)]
struct SseContentDelta {
    #[serde(rename = "type")]
    delta_type: String,
    #[serde(default)]
    text: String,
}

#[derive(Deserialize)]
struct SseEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<SseContentDelta>,
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

pub async fn summarize_stream(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    system_prompt: &str,
    transcript: &str,
    max_tokens: u32,
    temperature: f64,
    channel: &Channel<StreamEvent>,
) -> Result<String, String> {
    let body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_prompt,
        "messages": [
            {
                "role": "user",
                "content": format!("Please summarize the following YouTube video transcript:\n\n{}", transcript)
            }
        ],
        "stream": true
    });

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to call Claude API: {}", e))?;

    if !response.status().is_success() {
        let status = response.status().as_u16();
        let error_body = response.text().await.unwrap_or_default();

        return match status {
            401 => Err("Invalid API key. Please check your key in Settings.".to_string()),
            429 => Err("Rate limit exceeded. Please wait a moment and try again.".to_string()),
            _ => Err(format!("Claude API error ({}): {}", status, error_body)),
        };
    }

    // Stream SSE response
    let mut buffer = String::new();
    let mut full_summary = String::new();

    let mut stream = response;
    while let Some(chunk) = stream
        .chunk()
        .await
        .map_err(|e| format!("Stream read error: {}", e))?
    {
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        let (events, remaining) = parse_sse_lines(&buffer);
        buffer = remaining;

        for (_event_name, data) in events {
            if data == "[DONE]" {
                continue;
            }
            if let Ok(event) = serde_json::from_str::<SseEvent>(&data) {
                if event.event_type == "content_block_delta" {
                    if let Some(delta) = &event.delta {
                        if delta.delta_type == "text_delta" && !delta.text.is_empty() {
                            full_summary.push_str(&delta.text);
                            let _ = channel.send(StreamEvent::Delta {
                                text: delta.text.clone(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(full_summary)
}
