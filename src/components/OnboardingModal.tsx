'use client';

import { useState, useCallback, useEffect, type FormEvent } from 'react';
import ApiKeyInput from '@/components/ApiKeyInput';
import { saveApiKey } from '@/lib/tauri';
import { PROVIDERS } from '@/constants';
import {
  ONBOARDING_COPY,
  PROVIDER_LABELS,
  PROVIDER_KEY_PLACEHOLDER,
  PROVIDER_CONSOLE,
  KEY_STORAGE_NOTE,
} from '@/constants/copy';
import type { Provider } from '@/types';

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingModal({ onComplete, onSkip }: OnboardingModalProps) {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    e?.preventDefault();
    if (!key.trim() || saving) return;

    setError('');
    setSaving(true);
    try {
      await saveApiKey(provider, key.trim());
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [key, provider, saving, onComplete]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay">
      <div className="glass-card w-full max-w-md mx-4 p-8" role="dialog" aria-modal="true">
        <h2 className="text-xl font-semibold mb-2">{ONBOARDING_COPY.title}</h2>
        <p className="text-sm text-muted mb-6">{ONBOARDING_COPY.intro}</p>

        <div className="flex gap-2 mb-4" role="group" aria-label={ONBOARDING_COPY.providerLegend}>
          {PROVIDERS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setProvider(p); setError(''); }}
              aria-pressed={provider === p}
              className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                provider === p
                  ? 'bg-accent text-black'
                  : 'bg-input-bg text-foreground hover:bg-card-border'
              }`}
            >
              {PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="bg-input-bg rounded-lg p-4 mb-4">
          <p className="text-sm font-medium mb-1">{ONBOARDING_COPY.stepOneTitle}</p>
          <p className="text-sm text-muted mb-2">{ONBOARDING_COPY.stepOneBody(provider)}</p>
          <a
            href={PROVIDER_CONSOLE[provider].url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            {PROVIDER_CONSOLE[provider].label}
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-input-bg rounded-lg p-4 mb-6">
          <label htmlFor="onboarding-api-key" className="block text-sm font-medium mb-1">
            {ONBOARDING_COPY.stepTwoTitle}
          </label>
          <p className="text-sm text-muted mb-3">{ONBOARDING_COPY.stepTwoBody}</p>
          <ApiKeyInput
            id="onboarding-api-key"
            value={key}
            onChange={(value) => { setKey(value); setError(''); }}
            placeholder={PROVIDER_KEY_PLACEHOLDER[provider]}
            className="bg-background"
            autoFocus
          />
          {error ? <p className="text-red-500 text-xs mt-2">{error}</p> : null}
        </form>

        <button
          onClick={() => handleSubmit()}
          disabled={!key.trim() || saving}
          className="w-full bg-accent hover:bg-accent-hover text-black py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-3"
        >
          {saving ? ONBOARDING_COPY.submitting : ONBOARDING_COPY.submit}
        </button>

        <p className="text-xs text-muted text-center mb-4">{KEY_STORAGE_NOTE}</p>

        <button
          onClick={onSkip}
          className="block mx-auto text-sm text-muted hover:text-foreground transition-colors"
        >
          {ONBOARDING_COPY.skip}
        </button>
      </div>
    </div>
  );
}
