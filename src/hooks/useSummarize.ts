'use client';

import { useState, useCallback } from 'react';
import type { SummaryLength, SummaryLanguage, VideoMetadata, StreamEvent } from '@/types';
import { SUMMARY_LENGTH_CONFIG, DEFAULT_MODEL } from '@/constants';
import { extractVideoId } from '@/utils/video';
import { getSummarizePrompt } from '@/prompts/summarize';

interface UseSummarizeReturn {
  summary: string;
  isLoading: boolean;
  error: string | null;
  metadata: VideoMetadata | null;
  submitUrl: (url: string, length: SummaryLength, language: SummaryLanguage) => void;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useSummarize(): UseSummarizeReturn {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const submitUrl = useCallback(async (url: string, length: SummaryLength, language: SummaryLanguage) => {
    setSummary('');
    setError(null);
    setMetadata(null);
    setIsLoading(true);

    try {
      const videoId = extractVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL or video ID. Please provide a valid link.');
      }

      if (!isTauri()) {
        throw new Error('Summarization requires the Tauri desktop app. Run with: npm run tauri:dev');
      }

      const { invoke, Channel } = await import('@tauri-apps/api/core');

      const systemPrompt = getSummarizePrompt(length, language);
      const maxTokens = SUMMARY_LENGTH_CONFIG[length].maxTokens;

      const onEvent = new Channel<StreamEvent>();
      onEvent.onmessage = (event: StreamEvent) => {
        switch (event.type) {
          case 'metadata':
            if (event.title) {
              setMetadata({
                id: videoId,
                title: event.title,
                author: event.author ?? '',
              });
            }
            break;
          case 'delta':
            if (event.text) {
              setSummary((prev) => prev + event.text);
            }
            break;
          case 'error':
            setError(event.message ?? 'An unexpected error occurred');
            break;
          case 'done':
            break;
        }
      };

      await invoke('summarize', {
        videoId,
        systemPrompt,
        maxTokens,
        model: DEFAULT_MODEL,
        length,
        language,
        onEvent,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { summary, isLoading, error, metadata, submitUrl };
}
