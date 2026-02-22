'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import SummarizerForm from '@/components/SummarizerForm';
import VideoInfo from '@/components/VideoInfo';
import SummaryDisplay from '@/components/SummaryDisplay';
import { hasApiKey } from '@/lib/tauri';
import { useSummarize } from '@/hooks/useSummarize';
import type { SummaryLength, SummaryLanguage } from '@/types';

const ParticleCanvas = dynamic(() => import('@/components/ParticleCanvas'), { ssr: false });
const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), { ssr: false });
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'), { ssr: false });

const FOOTER_TEXT = 'Powered by Claude AI · AI can make mistakes.';

export default function Home() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { summary, isLoading, error, metadata, submitUrl } = useSummarize();

  useEffect(() => {
    hasApiKey().then((result) => {
      setHasKey(result);
      if (!result) setShowOnboarding(true);
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setHasKey(true);
    setShowOnboarding(false);
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleSubmit = useCallback((url: string, length: SummaryLength, language: SummaryLanguage) => {
    submitUrl(url, length, language);
  }, [submitUrl]);

  // Don't render until we've checked API key status
  if (hasKey === null) return null;

  return (
    <div className="relative flex flex-col min-h-screen max-w-2xl mx-auto">
      <ParticleCanvas />
      <Header onOpenSettings={() => setShowSettings(true)} />

      <main className="flex-1 px-6 pb-6 space-y-4">
        <SummarizerForm
          onSubmit={handleSubmit}
          disabled={!hasKey}
          isLoading={isLoading}
        />

        {error ? (
          <div className="glass-card px-6 py-4 border-red-500/30 bg-red-500/5">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        ) : null}

        <VideoInfo
          title={metadata?.title}
          channel={metadata?.author}
          videoId={metadata?.id}
        />

        <SummaryDisplay content={summary} isLoading={isLoading} videoId={metadata?.id} />
      </main>

      <footer className="px-6 py-4 text-center text-xs text-muted">
        {FOOTER_TEXT}
      </footer>

      {showOnboarding ? (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      ) : null}

      {showSettings ? (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      ) : null}
    </div>
  );
}
