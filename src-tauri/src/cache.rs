use std::collections::HashMap;

const CACHE_TTL_MS: u128 = 86_400_000; // 24 hours
const CACHE_MAX_SIZE: usize = 500;

struct CacheEntry {
    summary: String,
    created_at: std::time::Instant,
}

pub struct SummaryCache {
    entries: HashMap<String, CacheEntry>,
}

impl SummaryCache {
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
        }
    }

    /// Build a cache key. The model belongs in it: without it, switching model
    /// and re-summarizing replays the previous model's answer and the picker
    /// looks like it does nothing.
    pub fn key(video_id: &str, model: &str, length: &str, language: &str) -> String {
        format!("{}:{}:{}:{}", video_id, model, length, language)
    }

    pub fn get(&self, key: &str) -> Option<&str> {
        let entry = self.entries.get(key)?;
        let elapsed = entry.created_at.elapsed().as_millis();
        if elapsed > CACHE_TTL_MS {
            return None;
        }
        Some(&entry.summary)
    }

    pub fn set(&mut self, key: String, summary: String) {
        self.entries.insert(
            key,
            CacheEntry {
                summary,
                created_at: std::time::Instant::now(),
            },
        );
        self.cleanup();
    }

    fn cleanup(&mut self) {
        // Remove expired entries
        self.entries
            .retain(|_, entry| entry.created_at.elapsed().as_millis() <= CACHE_TTL_MS);

        // If still over limit, remove oldest entries
        if self.entries.len() > CACHE_MAX_SIZE {
            let mut entries: Vec<(String, std::time::Instant)> = self
                .entries
                .iter()
                .map(|(k, v)| (k.clone(), v.created_at))
                .collect();
            entries.sort_by_key(|(_, t)| *t);

            let to_remove = entries.len() - CACHE_MAX_SIZE;
            for (key, _) in entries.into_iter().take(to_remove) {
                self.entries.remove(&key);
            }
        }
    }
}
