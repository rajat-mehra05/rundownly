'use client';

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { saveApiKey } from '@/lib/tauri';

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    if (!key.trim()) return;

    if (!key.startsWith('sk-ant-')) {
      setError("That doesn't look like an Anthropic API key");
      return;
    }

    setError('');
    setSaving(true);
    try {
      await saveApiKey(key.trim());
      onComplete();
    } finally {
      setSaving(false);
    }
  }, [key, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'Enter' && key.trim()) handleSubmit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip, key, handleSubmit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="glass-card w-full max-w-md mx-4 p-8" role="dialog" aria-modal="true">
        <h2 className="text-xl font-semibold mb-2">Welcome to Rundownly</h2>
        <p className="text-sm text-muted mb-6">
          To get started, you&apos;ll need an Anthropic API key. This key stays on your machine
          &mdash; stored securely in your OS keychain.
        </p>

        {/* Step 1 */}
        <div className="bg-input-bg rounded-lg p-4 mb-4">
          <p className="text-sm font-medium mb-1">Step 1</p>
          <p className="text-sm text-muted mb-2">Get a free API key from Anthropic</p>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Open Anthropic Console &rarr;
          </a>
        </div>

        {/* Step 2 */}
        <form onSubmit={handleSubmit} className="bg-input-bg rounded-lg p-4 mb-6">
          <p className="text-sm font-medium mb-1">Step 2</p>
          <p className="text-sm text-muted mb-3">Paste your API key below</p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => { setKey(e.target.value); setError(''); }}
              placeholder="sk-ant-..."
              className="w-full bg-background border border-input-border rounded-lg px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-accent/40"
              autoFocus
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
          {error ? <p className="text-red-500 text-xs mt-2">{error}</p> : null}
        </form>

        {/* Actions */}
        <button
          onClick={() => handleSubmit()}
          disabled={!key.trim() || saving}
          className="w-full bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {saving ? 'Saving...' : 'Start Summarizing'}
        </button>

        <p className="text-xs text-muted text-center mb-4">
          Your key is encrypted and stored in your OS keychain. We never see it.
        </p>

        <button
          onClick={onSkip}
          className="block mx-auto text-sm text-muted hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
