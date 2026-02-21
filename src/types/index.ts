export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryLanguage = 'en' | 'es' | 'fr' | 'de' | 'pt' | 'ja' | 'ko' | 'zh' | 'hi' | 'ar' | 'as';

export interface VideoMetadata {
  id: string;
  title: string;
  author: string;
}

export interface StreamEvent {
  type: 'metadata' | 'delta' | 'done' | 'error';
  title?: string;
  author?: string;
  text?: string;
  message?: string;
}
