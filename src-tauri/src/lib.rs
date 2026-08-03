mod cache;
mod llm;
mod provider;
mod transcript;

use llm::StreamEvent;
use provider::{validate_key, Provider};
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri_plugin_store::{Store, StoreExt};
use tokio::sync::Mutex;

const STORE_NAME: &str = "settings.json";
const MODEL_FIELD: &str = "model";
const DEFAULT_MODEL: &str = "claude-sonnet-5";
const MAX_TRANSCRIPT_LENGTH: usize = 100_000;

struct AppState {
    client: reqwest::Client,
    cache: Mutex<cache::SummaryCache>,
}

#[derive(Serialize, Deserialize)]
struct Settings {
    model: String,
}

#[derive(Serialize)]
struct KeyStatus {
    anthropic: bool,
    openai: bool,
}

// --- Key Storage ---

/// Read a provider's key, treating blank or whitespace-only as absent.
fn stored_key<R: tauri::Runtime>(store: &Store<R>, provider: Provider) -> Option<String> {
    store
        .get(provider.key_field())
        .and_then(|v| v.as_str().map(str::trim).map(String::from))
        .filter(|key| !key.is_empty())
}

/// Move a pre-2.1 single key into the Anthropic slot. Returns whether the store changed,
/// so a normal launch does not rewrite the file for nothing.
fn migrate_legacy_key<R: tauri::Runtime>(store: &Store<R>) -> bool {
    let Some(legacy) = store.get(provider::LEGACY_KEY_FIELD) else {
        return false;
    };
    let legacy_key = legacy.as_str().unwrap_or_default().trim().to_string();

    // A blank legacy value must not become a blank Anthropic key, or the app believes it
    // has a key, never prompts for one, and leaves the user with a permanently dead button.
    if !legacy_key.is_empty() && stored_key(store, Provider::Anthropic).is_none() {
        store.set(Provider::Anthropic.key_field(), serde_json::json!(legacy_key));
    }

    store.delete(provider::LEGACY_KEY_FIELD);
    true
}

// --- Settings Commands ---

#[tauri::command]
async fn get_key_status(app: tauri::AppHandle) -> Result<KeyStatus, String> {
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    Ok(KeyStatus {
        anthropic: stored_key(&store, Provider::Anthropic).is_some(),
        openai: stored_key(&store, Provider::OpenAI).is_some(),
    })
}

#[tauri::command]
async fn save_api_key(app: tauri::AppHandle, provider: Provider, key: String) -> Result<(), String> {
    // Keys copied from a web page very often carry a trailing newline.
    let key = key.trim();
    validate_key(provider, key)?;

    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    store.set(provider.key_field(), serde_json::json!(key));
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
    provider: Provider,
    model: String,
    length: String,
    language: String,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    // 1. Get API key from store
    let store = app.store(STORE_NAME).map_err(|e| e.to_string())?;
    let api_key = stored_key(&store, provider).ok_or_else(|| {
        format!(
            "No {} API key configured. Please add your key in Settings.",
            provider.label()
        )
    })?;

    // 2. Check cache
    let cache_key = cache::SummaryCache::key(&video_id, &model, &length, &language);
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

    // 6. Stream the model's response
    let summary = llm::summarize_stream(
        &state.client,
        &api_key,
        &llm::SummaryRequest {
            provider,
            model: &model,
            system_prompt: &system_prompt,
            transcript: &transcript_data.text,
            max_tokens,
        },
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
        .setup(|app| {
            // Never block boot on this. A failed write leaves the legacy key on disk
            // and the migration simply runs again next launch.
            if let Ok(store) = app.store(STORE_NAME) {
                if migrate_legacy_key(&store) {
                    let _ = store.save();
                }
            }
            Ok(())
        })
        .manage(AppState {
            client: reqwest::Client::builder()
                .cookie_store(true)
                .build()
                .expect("failed to build HTTP client"),
            cache: Mutex::new(cache::SummaryCache::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_key_status,
            save_api_key,
            get_settings,
            save_settings,
            summarize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
