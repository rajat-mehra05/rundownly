import type { KeyStatus, Provider } from '@/types';
import { DEFAULT_MODEL } from '@/constants';

export interface Settings {
  model: string;
}

const NO_KEYS: KeyStatus = { anthropic: false, openai: false };

// Tauri APIs are only available inside the Tauri WebView.
// When running via `npm run dev` (plain browser), fall back to stubs.
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export async function getKeyStatus(): Promise<KeyStatus> {
  if (!isTauri()) return NO_KEYS;
  return tauriInvoke<KeyStatus>('get_key_status');
}

export async function saveApiKey(provider: Provider, key: string): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke('save_api_key', { provider, key });
}

export async function getSettings(): Promise<Settings> {
  if (!isTauri()) return { model: DEFAULT_MODEL };
  return tauriInvoke<Settings>('get_settings');
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke('save_settings', { settings });
}
