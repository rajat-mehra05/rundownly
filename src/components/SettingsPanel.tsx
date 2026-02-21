'use client';

import { useState, useCallback, useEffect } from 'react';
import { saveApiKey, getSettings, saveSettings } from '@/lib/tauri';
import { DEFAULT_MODEL } from '@/constants';

const MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings().then((s) => setModel(s.model));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setError('');
    try {
      if (apiKey.trim()) {
        await saveApiKey(apiKey.trim());
      }
      await saveSettings({ model });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [apiKey, model, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-overlay">
      <div
        className="w-full max-w-sm h-full bg-background border-l border-card-border p-6 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground p-1 transition-colors"
            aria-label="Close settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* API Key */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-... (leave blank to keep current)"
              className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              )}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {error ? <p className="text-red-500 text-xs mb-4">{error}</p> : null}

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );
}
