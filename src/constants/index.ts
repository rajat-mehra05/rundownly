import type { ModelOption, Provider, SummaryLength, SummaryLanguage } from '@/types';

export const PROVIDERS: Provider[] = ['anthropic', 'openai'];

/*
  The single source of truth for which model belongs to which company. Rust is
  told the provider on every request and never guesses.
*/
export const MODELS: ModelOption[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5', provider: 'anthropic' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', provider: 'anthropic' },
  { id: 'gpt-5.1', label: 'GPT-5.1', provider: 'openai' },
  { id: 'gpt-5', label: 'GPT-5', provider: 'openai' },
];

// Grouped once at module load rather than re-derived in every render.
export const MODELS_BY_PROVIDER: { provider: Provider; models: ModelOption[] }[] =
  PROVIDERS.map((provider) => ({
    provider,
    models: MODELS.filter((m) => m.provider === provider),
  }));

export const DEFAULT_MODEL = 'claude-sonnet-5';

// Falls back rather than returning nothing: a model saved by an older version
// is no longer in the list, and a miss must not route to the wrong company.
export function providerForModel(modelId: string): Provider {
  return MODELS.find((m) => m.id === modelId)?.provider ?? 'anthropic';
}

export function isKnownModel(modelId: string): boolean {
  return MODELS.some((m) => m.id === modelId);
}

export function firstModelFor(provider: Provider): string {
  return MODELS.find((m) => m.provider === provider)?.id ?? DEFAULT_MODEL;
}

// Summary length configuration
export const SUMMARY_LENGTH_CONFIG: Record<SummaryLength, { maxTokens: number; label: string; description: string }> = {
  short:  { maxTokens: 1024,  label: 'Short',  description: 'Key takeaways' },
  medium: { maxTokens: 2048,  label: 'Medium', description: 'Balanced summary' },
  long:   { maxTokens: 4096,  label: 'Long',   description: 'Full detail' },
};

export const DEFAULT_SUMMARY_LANGUAGE: SummaryLanguage = 'en';

// Language configuration
export const LANGUAGE_OPTIONS: { value: SummaryLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese (Simplified)' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ar', label: 'Arabic' },
  { value: 'as', label: 'Assamese' },
];

export const LANGUAGE_NAMES: Record<SummaryLanguage, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.map((o) => [o.value, o.label])
) as Record<SummaryLanguage, string>;

// UI
export const COPY_FEEDBACK_DURATION_MS = 2000;

// Video ID validation
export const VIDEO_ID_LENGTH = 11;
export const VIDEO_ID_REGEX = new RegExp(`^[a-zA-Z0-9_-]{${VIDEO_ID_LENGTH}}$`);
