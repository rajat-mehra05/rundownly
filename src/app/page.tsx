'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import SummarizerForm from '@/components/SummarizerForm';
import VideoInfo from '@/components/VideoInfo';
import SummaryDisplay from '@/components/SummaryDisplay';
import { getKeyStatus } from '@/lib/tauri';
import { useSummarize } from '@/hooks/useSummarize';
import type { KeyStatus, SummaryLength, SummaryLanguage } from '@/types';

const ParticleCanvas = dynamic(() => import('@/components/ParticleCanvas'), { ssr: false });
const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), { ssr: false });
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'), { ssr: false });


export default function Home() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { summary, isLoading, error, metadata, submitUrl } = useSummarize();

  const refreshKeyStatus = useCallback(async () => {
    setKeyStatus(await getKeyStatus());
  }, []);

  useEffect(() => {
    getKeyStatus().then((status) => {
      setKeyStatus(status);
      if (!status.anthropic && !status.openai) setShowOnboarding(true);
    });
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    void refreshKeyStatus();
  }, [refreshKeyStatus]);

  const handleOnboardingSkip = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    void refreshKeyStatus();
  }, [refreshKeyStatus]);

  const handleSubmit = useCallback((url: string, length: SummaryLength, language: SummaryLanguage) => {
    submitUrl(url, length, language);
  }, [submitUrl]);

  if (keyStatus === null) return null;

  return (
    <div className="relative flex flex-col min-h-screen max-w-2xl mx-auto">
      <ParticleCanvas />
      <Header onOpenSettings={() => setShowSettings(true)} />

      <main className="flex-1 px-6 pb-6 space-y-4">
        <SummarizerForm
          onSubmit={handleSubmit}
          disabled={!keyStatus.anthropic}
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

      <footer className="px-6 py-4 text-center text-xs text-muted space-y-1">
        <div className="flex items-center justify-center gap-1">
          <a href="https://github.com/rajat-mehra05" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
          <span>·</span>
          <span>Built by Rajat Mehra</span>
        </div>
        <div>&copy; 2026 Rundownly</div>
      </footer>

      {showOnboarding ? (
        <OnboardingModal
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      ) : null}

      {showSettings ? (
        <SettingsPanel keyStatus={keyStatus} onClose={handleCloseSettings} />
      ) : null}
    </div>
  );
}
