use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;
use std::time::Duration;

const CHUNK_INTERVAL_SECONDS: f64 = 30.0;
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const METADATA_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);

static CAPTION_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?s)<text start="([^"]*)" dur="([^"]*)"[^>]*>(.*?)</text>"#)
        .expect("invalid CAPTION_RE regex")
});

static INNERTUBE_KEY_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#""INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)""#)
        .expect("invalid INNERTUBE_KEY_RE regex")
});

static CONSENT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"name="v" value="([^"]+)""#)
        .expect("invalid CONSENT_RE regex")
});

#[derive(Debug, Deserialize)]
struct CaptionTrack {
    #[serde(rename = "baseUrl")]
    base_url: String,
    #[serde(rename = "languageCode")]
    language_code: String,
    #[serde(default)]
    kind: String, // "asr" = auto-generated
    #[serde(default)]
    #[serde(rename = "isTranslatable")]
    is_translatable: bool,
}

#[derive(Debug)]
struct TranscriptSnippet {
    start: f64,
    text: String,
}

pub struct TranscriptResult {
    pub text: String,
}

pub struct VideoMetadata {
    pub title: String,
    pub author: String,
}

fn format_timestamp(seconds: f64) -> String {
    let total = seconds as u64;
    let h = total / 3600;
    let m = (total % 3600) / 60;
    let s = total % 60;
    if h > 0 {
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        format!("{}:{:02}", m, s)
    }
}

fn format_transcript_with_timestamps(snippets: &[TranscriptSnippet]) -> String {
    if snippets.is_empty() {
        return String::new();
    }

    let mut chunks: Vec<String> = Vec::new();
    let mut current_texts: Vec<&str> = Vec::new();
    let mut chunk_start = snippets[0].start;

    for snippet in snippets {
        if snippet.start - chunk_start >= CHUNK_INTERVAL_SECONDS && !current_texts.is_empty() {
            chunks.push(format!("[{}] {}", format_timestamp(chunk_start), current_texts.join(" ")));
            current_texts.clear();
            chunk_start = snippet.start;
        }
        current_texts.push(snippet.text.trim());
    }

    if !current_texts.is_empty() {
        chunks.push(format!("[{}] {}", format_timestamp(chunk_start), current_texts.join(" ")));
    }

    chunks.join("\n")
}

fn decode_html_entities(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&apos;", "'")
        .replace("\n", " ")
}

fn parse_caption_xml(xml: &str) -> Vec<TranscriptSnippet> {
    let mut snippets = Vec::new();

    for cap in CAPTION_RE.captures_iter(xml) {
        let start: f64 = cap[1].parse().unwrap_or(0.0);
        let text = decode_html_entities(&cap[3]);
        if !text.trim().is_empty() {
            snippets.push(TranscriptSnippet { start, text });
        }
    }

    snippets
}

/// Fetch watch page HTML, handling GDPR consent redirects.
async fn fetch_watch_page(client: &reqwest::Client, video_id: &str) -> Result<String, String> {
    let url = format!("https://www.youtube.com/watch?v={}", video_id);
    let response = client
        .get(&url)
        .timeout(REQUEST_TIMEOUT)
        .header("User-Agent", USER_AGENT)
        .header("Accept-Language", "en-US")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch video page: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("YouTube returned HTTP {} for video page", status.as_u16()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Failed to read video page: {}", e))?;

    // Handle GDPR consent redirect (common in EU regions)
    if html.contains("action=\"https://consent.youtube.com/s\"") {
        let cap = CONSENT_RE.captures(&html).ok_or_else(|| {
            "GDPR consent page detected but consent token not found".to_string()
        })?;
        let consent_value = &cap[1];
        let cookie = format!("CONSENT=YES+{}", consent_value);
        let retry_response = client
            .get(&url)
            .timeout(REQUEST_TIMEOUT)
            .header("User-Agent", USER_AGENT)
            .header("Accept-Language", "en-US")
            .header("Cookie", cookie)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch video page (consent retry): {}", e))?;

        let retry_status = retry_response.status();
        if !retry_status.is_success() {
            return Err(format!(
                "YouTube returned HTTP {} on consent retry",
                retry_status.as_u16()
            ));
        }

        let retry = retry_response
            .text()
            .await
            .map_err(|e| format!("Failed to read video page: {}", e))?;

        if retry.contains("action=\"https://consent.youtube.com/s\"") {
            return Err("YouTube consent page persisted after retry. Try again later.".to_string());
        }

        return Ok(retry);
    }

    Ok(html)
}

/// Extract INNERTUBE_API_KEY from watch page HTML.
fn extract_innertube_key(html: &str) -> Option<String> {
    INNERTUBE_KEY_RE.captures(html).map(|c| c[1].to_string())
}

/// Call YouTube Innertube API to get caption tracks (avoids PoToken requirement).
async fn fetch_caption_tracks(
    client: &reqwest::Client,
    video_id: &str,
    api_key: &str,
) -> Result<Vec<CaptionTrack>, String> {
    let url = format!(
        "https://www.youtube.com/youtubei/v1/player?key={}",
        api_key
    );

    let body = serde_json::json!({
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": "20.10.38"
            }
        },
        "videoId": video_id
    });

    let raw_resp = client
        .post(&url)
        .timeout(REQUEST_TIMEOUT)
        .header("Content-Type", "application/json")
        .header("User-Agent", USER_AGENT)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to call Innertube API: {}", e))?;

    let status = raw_resp.status();
    if !status.is_success() {
        let body_preview: String = raw_resp
            .text()
            .await
            .unwrap_or_default()
            .chars()
            .take(200)
            .collect();
        return Err(format!(
            "Innertube API returned HTTP {}: {}",
            status.as_u16(),
            body_preview
        ));
    }

    let resp: serde_json::Value = raw_resp
        .json()
        .await
        .map_err(|e| format!("Invalid Innertube response: {}", e))?;

    let tracks_value = resp
        .pointer("/captions/playerCaptionsTracklistRenderer/captionTracks")
        .ok_or_else(|| "No captions available for this video.".to_string())?;

    let tracks: Vec<CaptionTrack> = serde_json::from_value(tracks_value.clone())
        .map_err(|e| format!("Failed to parse caption tracks: {}", e))?;

    if tracks.is_empty() {
        return Err("No transcript tracks found for this video.".to_string());
    }

    Ok(tracks)
}

pub async fn fetch_transcript(
    client: &reqwest::Client,
    video_id: &str,
) -> Result<TranscriptResult, String> {
    // 1. Fetch watch page to get INNERTUBE_API_KEY
    let html = fetch_watch_page(client, video_id).await?;

    let api_key = extract_innertube_key(&html)
        .ok_or_else(|| "Could not find YouTube API key. Video may be unavailable.".to_string())?;

    // 2. Use Innertube API to get caption tracks (no PoToken requirement)
    let tracks = fetch_caption_tracks(client, video_id, &api_key).await?;

    // 3. Choose the best track (manual English > generated English > any translatable > first)
    let manual: Vec<&CaptionTrack> = tracks.iter().filter(|t| t.kind != "asr").collect();
    let generated: Vec<&CaptionTrack> = tracks.iter().filter(|t| t.kind == "asr").collect();
    let ranked: Vec<&CaptionTrack> = manual.iter().chain(generated.iter()).copied().collect();

    let chosen = ranked
        .iter()
        .find(|t| t.language_code == "en")
        .or_else(|| ranked.iter().find(|t| t.language_code.starts_with("en")))
        .or_else(|| ranked.first())
        .ok_or_else(|| "No suitable transcript track found.".to_string())?;

    // 4. Build caption URL — strip fmt=srv3 so YouTube returns default <text> XML format
    let base = chosen
        .base_url
        .replace("&fmt=srv3", "")
        .replace("&fmt=srv2", "");
    let caption_url = if !chosen.language_code.starts_with("en") && chosen.is_translatable {
        format!("{}&tlang=en", base)
    } else {
        base
    };

    // 5. Fetch the caption XML
    let caption_resp = client
        .get(&caption_url)
        .timeout(REQUEST_TIMEOUT)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch captions: {}", e))?;

    let caption_status = caption_resp.status();
    if !caption_status.is_success() {
        return Err(match caption_status.as_u16() {
            429 => "YouTube is rate-limiting your requests. Wait a minute and try again.".to_string(),
            403 => "YouTube blocked the caption request. Try a different video or wait a few minutes.".to_string(),
            404 => "Captions not found for this video.".to_string(),
            _ => format!("Caption fetch failed (HTTP {}). Try again shortly.", caption_status.as_u16()),
        });
    }

    let caption_xml = caption_resp
        .text()
        .await
        .map_err(|e| format!("Failed to read captions: {}", e))?;

    // 6. Parse XML into snippets
    let snippets = parse_caption_xml(&caption_xml);
    if snippets.is_empty() {
        let lower = caption_xml.to_lowercase();
        if lower.contains("<title>sorry</title>") || lower.contains("google.com/recaptcha") {
            return Err("YouTube is temporarily blocking requests from your IP. Please wait a minute and try again.".to_string());
        }
        let preview: String = caption_xml.chars().take(200).collect();
        return Err(format!(
            "Could not parse transcript. Response preview: {}",
            preview
        ));
    }

    // 7. Format with timestamps
    let text = format_transcript_with_timestamps(&snippets);

    Ok(TranscriptResult { text })
}

pub async fn fetch_metadata(
    client: &reqwest::Client,
    video_id: &str,
) -> Result<VideoMetadata, String> {
    let url = format!(
        "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D{}&format=json",
        video_id
    );

    let resp = client
        .get(&url)
        .timeout(METADATA_REQUEST_TIMEOUT)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch metadata: {}", e))?;

    if !resp.status().is_success() {
        return Err("Could not fetch video metadata.".to_string());
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Invalid metadata JSON: {}", e))?;

    Ok(VideoMetadata {
        title: data["title"].as_str().unwrap_or("").to_string(),
        author: data["author_name"].as_str().unwrap_or("").to_string(),
    })
}
