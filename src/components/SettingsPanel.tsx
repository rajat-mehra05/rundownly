'use client';

import { useState, useCallback, useEffect } from 'react';
import ApiKeyInput from '@/components/ApiKeyInput';
import { saveApiKey } from '@/lib/tauri';
import { PROVIDERS } from '@/constants';
import {
  SETTINGS_COPY,
  PROVIDER_LABELS,
  PROVIDER_KEY_PLACEHOLDER,
  KEY_STORAGE_NOTE,
} from '@/constants/copy';
import type { KeyStatus, Provider } from '@/types';

interface SettingsPanelProps {
  keyStatus: KeyStatus;
  onClose: () => void;
}

const EMPTY_KEYS: Record<Provider, string> = { anthropic: '', openai: '' };

export default function SettingsPanel({ keyStatus, onClose }: SettingsPanelProps) {
  const [keys, setKeys] = useState(EMPTY_KEYS);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setError('');
    setSaving(true);
    const failures: string[] = [];
    try {
      for (const provider of PROVIDERS) {
        const key = keys[provider].trim();
        if (!key) continue;
        try {
          await saveApiKey(provider, key);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          failures.push(`${PROVIDER_LABELS[provider]}: ${reason}`);
        }
      }
    } finally {
      setSaving(false);
    }

    if (failures.length > 0) {
      setError(failures.join(' '));
      return;
    }
    onClose();
  }, [keys, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay">
      <div
        className="w-full max-w-sm h-full bg-background border-l border-card-border p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">{SETTINGS_COPY.title}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 transition-colors"
            aria-label={SETTINGS_COPY.close}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {PROVIDERS.map((provider) => (
          <div key={provider} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor={`${provider}-key`} className="text-sm font-medium">
                {SETTINGS_COPY.keyLabel(provider)}
              </label>
              <span className={`text-xs ${keyStatus[provider] ? 'text-accent' : 'text-muted'}`}>
                {keyStatus[provider] ? SETTINGS_COPY.keySaved : SETTINGS_COPY.keyMissing}
              </span>
            </div>
            <ApiKeyInput
              id={`${provider}-key`}
              value={keys[provider]}
              onChange={(value) => setKeys((prev) => ({ ...prev, [provider]: value }))}
              placeholder={PROVIDER_KEY_PLACEHOLDER[provider]}
            />
            {keyStatus[provider] ? (
              <p className="text-xs text-muted mt-2">{SETTINGS_COPY.keepCurrent}</p>
            ) : null}
          </div>
        ))}

        {error ? <p className="text-red-500 text-xs mb-4">{error}</p> : null}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-accent hover:bg-accent-hover text-black py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? SETTINGS_COPY.saving : SETTINGS_COPY.save}
        </button>

        <p className="text-xs text-muted text-center mt-4">{KEY_STORAGE_NOTE}</p>
      </div>
    </div>
  );
}
