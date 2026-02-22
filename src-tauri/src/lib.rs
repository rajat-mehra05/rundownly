mod cache;
mod claude;
mod transcript;

use claude::StreamEvent;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri_plugin_store::StoreExt;
use tokio::sync::Mutex;

const STORE_NAME: &str = "settings.json";
const API_KEY_FIELD: &str = "api_key";
const MODEL_FIELD: &str = "model";
const DEFAULT_MODEL: &str = "claude-sonnet-4-5-20250929";
const DEFAULT_TEMPERATURE: f64 = 0.7;
const MAX_TRANSCRIPT_LENGTH: usize = 100_000;

struct AppState {
    client: reqwest::Client,
    cache: Mutex<cache::SummaryCache>,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    model: String,
}

// --- Settings Commands ---

#[tauri::command]
async fn has_api_key(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    match store.get(API_KEY_FIELD) {
        Some(val) => {
            let key = val.as_str().unwrap_or("");
            Ok(!key.is_empty())
        }
        None => Ok(false),
    }
}

#[tauri::command]
async fn save_api_key(app: tauri::AppHandle, key: String) -> Result<(), String> {
    if !key.starts_with("sk-ant-") {
        return Err("Invalid API key format. Key should start with 'sk-ant-'.".to_string());
    }
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    store.set(API_KEY_FIELD, serde_json::json!(key));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn get_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    let model = store
        .get(MODEL_FIELD)
        .and_then(|v| v.as_str().map(String::from))
        .unwrap_or_else(|| DEFAULT_MODEL.to_string());
    Ok(Settings { model })
}

#[tauri::command]
async fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<(), String> {
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    store.set(MODEL_FIELD, serde_json::json!(settings.model));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

// --- Summarize Command (does everything) ---

#[tauri::command]
async fn summarize(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
    video_id: String,
    system_prompt: String,
    max_tokens: u32,
    model: String,
    length: String,
    language: String,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    // 1. Get API key from store
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    let api_key = store
        .get(API_KEY_FIELD)
        .and_then(|v| v.as_str().map(String::from))
        .ok_or_else(|| "No API key configured. Please add your key in Settings.".to_string())?;

    if api_key.is_empty() {
        return Err("No API key configured. Please add your key in Settings.".to_string());
    }

    // 2. Check cache
    let cache_key = cache::SummaryCache::key(&video_id, &length, &language);
    {
        let cache_guard = state.cache.lock().await;
        if let Some(cached_summary) = cache_guard.get(&cache_key) {
            // Fetch metadata even for cache hits so UI has video info
            if let Ok(meta) = transcript::fetch_metadata(&state.client, &video_id).await {
                let _ = on_event.send(StreamEvent::Metadata {
                    title: meta.title,
                    author: meta.author,
                });
            }
            // Send full cached summary as one delta
            let _ = on_event.send(StreamEvent::Delta {
                text: cached_summary.to_string(),
            });
            let _ = on_event.send(StreamEvent::Done);
            return Ok(());
        }
    }

    // 3. Fetch transcript + metadata in parallel
    let (transcript_result, metadata_result) = tokio::join!(
        transcript::fetch_transcript(&state.client, &video_id),
        transcript::fetch_metadata(&state.client, &video_id),
    );

    let transcript_data = transcript_result?;

    // 4. Send metadata event
    if let Ok(meta) = metadata_result {
        let _ = on_event.send(StreamEvent::Metadata {
            title: meta.title,
            author: meta.author,
        });
    }

    // 5. Validate transcript length
    if transcript_data.text.len() > MAX_TRANSCRIPT_LENGTH {
        return Err(format!(
            "Transcript is too long ({}k chars). Maximum is {}k characters.",
            transcript_data.text.len() / 1000,
            MAX_TRANSCRIPT_LENGTH / 1000
        ));
    }

    // 6. Stream Claude response
    let summary = claude::summarize_stream(
        &state.client,
        &api_key,
        &model,
        &system_prompt,
        &transcript_data.text,
        max_tokens,
        DEFAULT_TEMPERATURE,
        &on_event,
    )
    .await?;

    // 7. Cache the completed summary
    {
        let mut cache_guard = state.cache.lock().await;
        cache_guard.set(cache_key, summary);
    }

    // 8. Signal completion
    let _ = on_event.send(StreamEvent::Done);
    Ok(())
}

// --- App Entry ---

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            client: reqwest::Client::builder()
                .cookie_store(true)
                .build()
                .expect("failed to build HTTP client"),
            cache: Mutex::new(cache::SummaryCache::new()),
        })
        .invoke_handler(tauri::generate_handler![
            has_api_key,
            save_api_key,
            get_settings,
            save_settings,
            summarize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
