'use client';

import { useState, type FormEvent } from 'react';
import type { KeyStatus, SummaryLength, SummaryLanguage } from '@/types';
import {
  MODELS_BY_PROVIDER,
  SUMMARY_LENGTH_CONFIG,
  LANGUAGE_OPTIONS,
  DEFAULT_SUMMARY_LANGUAGE,
  providerForModel,
} from '@/constants';
import { SUMMARIZE_BUTTON, FORM_COPY, PROVIDER_LABELS } from '@/constants/copy';

const LENGTHS = (Object.entries(SUMMARY_LENGTH_CONFIG) as [SummaryLength, { label: string }][]).map(
  ([value, config]) => ({ value, label: config.label })
);

const SELECT_CLASS =
  'text-sm bg-input-bg border border-input-border rounded-lg pl-3 pr-8 py-1.5 text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-accent/40';

interface SummarizerFormProps {
  model: string;
  onModelChange: (model: string) => void;
  keyStatus: KeyStatus;
  isLoading: boolean;
  onSubmit: (url: string, length: SummaryLength, language: SummaryLanguage, model: string) => void;
}

function submitLabel(isLoading: boolean, hasKey: boolean, model: string): string {
  if (isLoading) return SUMMARIZE_BUTTON.loading;
  if (!hasKey) return SUMMARIZE_BUTTON.missingKey(providerForModel(model));
  return SUMMARIZE_BUTTON.idle;
}

export default function SummarizerForm({
  model,
  onModelChange,
  keyStatus,
  isLoading,
  onSubmit,
}: SummarizerFormProps) {
  const [url, setUrl] = useState('');
  const [length, setLength] = useState<SummaryLength | null>(null);
  const [language, setLanguage] = useState<SummaryLanguage>(DEFAULT_SUMMARY_LANGUAGE);

  const provider = providerForModel(model);
  const hasKey = keyStatus[provider];
  const canSubmit = Boolean(url.trim()) && length !== null && hasKey && !isLoading;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !length) return;
    onSubmit(url.trim(), length, language, model);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
      <div>
        <span id="length-label" className="block text-sm text-muted mb-2">
          {FORM_COPY.lengthLabel}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex gap-2" role="group" aria-labelledby="length-label">
            {LENGTHS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLength(l.value)}
                aria-pressed={length === l.value}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  length === l.value
                    ? 'bg-accent text-black'
                    : 'bg-input-bg text-foreground hover:bg-card-border'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <select
                aria-label={FORM_COPY.modelLabel}
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className={SELECT_CLASS}
              >
                {MODELS_BY_PROVIDER.map(({ provider: p, models }) => (
                  <optgroup key={p} label={PROVIDER_LABELS[p]}>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
            </div>

            <div className="relative">
              <select
                aria-label={FORM_COPY.languageLabel}
                value={language}
                onChange={(e) => setLanguage(e.target.value as SummaryLanguage)}
                className={SELECT_CLASS}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">▾</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="url"
          aria-label={FORM_COPY.urlLabel}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={FORM_COPY.urlPlaceholder}
          className="flex-1 min-w-0 bg-input-bg border border-input-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="shrink-0 bg-accent hover:bg-accent-hover text-black px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel(isLoading, hasKey, model)}
        </button>
      </div>

      {hasKey ? null : (
        <p className="text-xs text-muted">{FORM_COPY.missingKeyHint(provider)}</p>
      )}
    </form>
  );
}
