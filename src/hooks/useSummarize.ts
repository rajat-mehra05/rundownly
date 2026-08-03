'use client';

import { useState, useCallback, useRef } from 'react';
import type { SummaryLength, SummaryLanguage, VideoMetadata, StreamEvent } from '@/types';
import { SUMMARY_LENGTH_CONFIG, providerForModel } from '@/constants';
import { extractVideoId } from '@/utils/video';
import { getSummarizePrompt } from '@/prompts/summarize';

interface UseSummarizeReturn {
  summary: string;
  isLoading: boolean;
  error: string | null;
  metadata: VideoMetadata | null;
  submitUrl: (url: string, length: SummaryLength, language: SummaryLanguage, model: string) => void;
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function useSummarize(): UseSummarizeReturn {
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  // Tag each run so a superseded one cannot interleave its text or clear the
  // loading state that the newer run now owns.
  const latestRequest = useRef(0);

  const submitUrl = useCallback(async (
    url: string,
    length: SummaryLength,
    language: SummaryLanguage,
    model: string,
  ) => {
    const requestId = ++latestRequest.current;
    const isStale = () => latestRequest.current !== requestId;

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

      const onEvent = new Channel<StreamEvent>();
      onEvent.onmessage = (event: StreamEvent) => {
        if (isStale()) return;
        switch (event.type) {
          case 'metadata':
            if (event.title) {
              setMetadata({ id: videoId, title: event.title, author: event.author ?? '' });
            }
            break;
          case 'delta':
            if (event.text) setSummary((prev) => prev + event.text);
            break;
          case 'done':
            break;
        }
      };

      await invoke('summarize', {
        videoId,
        systemPrompt: getSummarizePrompt(length, language),
        maxTokens: SUMMARY_LENGTH_CONFIG[length].maxTokens,
        provider: providerForModel(model),
        model,
        length,
        language,
        onEvent,
      });
    } catch (err) {
      if (isStale()) return;
      // A half-written summary under an error message reads as success.
      setSummary('');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!isStale()) setIsLoading(false);
    }
  }, []);

  return { summary, isLoading, error, metadata, submitUrl };
}
