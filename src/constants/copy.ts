import type { Provider } from '@/types';

// Summarize button
export const SUMMARIZE_BUTTON = {
  idle: 'Summarize',
  loading: 'Summarizing...',
  chooseLength: 'Choose a length',
  // Summarizing is Anthropic-only until the model dropdown lands.
  missingKey: 'Add Anthropic key',
};

// Summarizer form
export const FORM_COPY = {
  lengthLabel: 'Length',
  urlPlaceholder: 'https://youtube.com/watch?v=...',
};

// Providers
export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

export const PROVIDER_KEY_PLACEHOLDER: Record<Provider, string> = {
  anthropic: 'sk-ant-...',
  openai: 'sk-proj-...',
};

export const PROVIDER_CONSOLE: Record<Provider, { url: string; label: string }> = {
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    label: 'Open Anthropic Console →',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    label: 'Open OpenAI dashboard →',
  },
};

// Keys live as plain text in a settings file, not a keychain. Say so.
export const KEY_STORAGE_NOTE =
  'Stored locally on your machine. Never sent anywhere except the provider you choose.';

export const KEY_INPUT_COPY = {
  show: 'Show key',
  hide: 'Hide key',
};

// Settings
export const SETTINGS_COPY = {
  title: 'Settings',
  close: 'Close settings',
  save: 'Save',
  saving: 'Saving...',
  keyLabel: (provider: Provider) => `${PROVIDER_LABELS[provider]} API key`,
  keySaved: 'Saved',
  keyMissing: 'Not set',
  keepCurrent: 'Leave blank to keep the current key.',
};

// Onboarding
export const ONBOARDING_COPY = {
  title: 'Welcome to Rundownly',
  intro: 'Pick a provider and paste an API key to get started.',
  providerLegend: 'Which provider are you setting up?',
  stepOneTitle: 'Step 1',
  stepOneBody: (provider: Provider) => `Get an API key from ${PROVIDER_LABELS[provider]}`,
  stepTwoTitle: 'Step 2',
  stepTwoBody: 'Paste your API key below',
  submit: 'Start Summarizing',
  submitting: 'Saving...',
  skip: 'Skip for now',
};
