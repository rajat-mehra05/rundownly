'use client';

import { useState, type FormEvent } from 'react';
import type { SummaryLength, SummaryLanguage } from '@/types';
import { SUMMARY_LENGTH_CONFIG, LANGUAGE_OPTIONS, DEFAULT_SUMMARY_LANGUAGE } from '@/constants';
import { SUMMARIZE_BUTTON, FORM_COPY } from '@/constants/copy';

const LENGTHS = (Object.entries(SUMMARY_LENGTH_CONFIG) as [SummaryLength, { label: string }][]).map(
  ([value, config]) => ({ value, label: config.label })
);

function submitLabel(isLoading: boolean, missingKey: boolean, length: SummaryLength | null): string {
  if (isLoading) return SUMMARIZE_BUTTON.loading;
  if (missingKey) return SUMMARIZE_BUTTON.missingKey;
  if (!length) return SUMMARIZE_BUTTON.chooseLength;
  return SUMMARIZE_BUTTON.idle;
}

interface SummarizerFormProps {
  onSubmit: (url: string, length: SummaryLength, language: SummaryLanguage) => void;
  disabled: boolean;
  isLoading: boolean;
}

export default function SummarizerForm({ onSubmit, disabled, isLoading }: SummarizerFormProps) {
  const [url, setUrl] = useState('');
  const [length, setLength] = useState<SummaryLength | null>(null);
  const [language, setLanguage] = useState<SummaryLanguage>(DEFAULT_SUMMARY_LANGUAGE);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !length || disabled) return;
    onSubmit(url.trim(), length, language);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted mr-2">{FORM_COPY.lengthLabel}</span>
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

        <div className="ml-auto">
          <div className="relative">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SummaryLanguage)}
              className="text-sm bg-input-bg border border-input-border rounded-lg px-3 py-1.5 pr-8 text-foreground appearance-none"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted text-xs">
              ▾
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={FORM_COPY.urlPlaceholder}
          className="flex-1 bg-input-bg border border-input-border rounded-lg px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={disabled || isLoading || !url.trim() || !length}
          className="bg-accent hover:bg-accent-hover text-black px-5 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel(isLoading, disabled, length)}
        </button>
      </div>
    </form>
  );
}
