import type { Provider, SummaryLength, SummaryLanguage } from '@/types';

// Anthropic defaults
export const DEFAULT_MODEL = 'claude-sonnet-4-6';

export const PROVIDERS: Provider[] = ['anthropic', 'openai'];

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
