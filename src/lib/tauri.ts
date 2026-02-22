export interface Settings {
  model: string;
}

// Tauri APIs are only available inside the Tauri WebView.
// When running via `npm run dev` (plain browser), fall back to stubs.
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function hasApiKey(): Promise<boolean> {
  if (!isTauri()) return false;
  return tauriInvoke<boolean>('has_api_key');
}

export async function saveApiKey(key: string): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke('save_api_key', { key });
}

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) return { model: 'claude-sonnet-4-6' };
  return tauriInvoke<Settings>('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke('save_settings', { settings });
}
