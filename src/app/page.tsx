'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import SummarizerForm from '@/components/SummarizerForm';
import VideoInfo from '@/components/VideoInfo';
import SummaryDisplay from '@/components/SummaryDisplay';
import { getKeyStatus, getSettings, saveSettings } from '@/lib/tauri';
import { useSummarize } from '@/hooks/useSummarize';
import { DEFAULT_MODEL, isKnownModel, providerForModel, firstModelFor } from '@/constants';
import type { KeyStatus } from '@/types';

const ParticleCanvas = dynamic(() => import('@/components/ParticleCanvas'), { ssr: false });
const OnboardingModal = dynamic(() => import('@/components/OnboardingModal'), { ssr: false });
const SettingsPanel = dynamic(() => import('@/components/SettingsPanel'), { ssr: false });

function startingModel(savedModel: string, keys: KeyStatus): string {
  const model = isKnownModel(savedModel) ? savedModel : DEFAULT_MODEL;
  const provider = providerForModel(model);
  if (keys[provider]) return model;

  const other = provider === 'anthropic' ? 'openai' : 'anthropic';
  return (keys[other] && firstModelFor(other)) || model;
}

export default function Home() {
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const { summary, isLoading, error, metadata, submitUrl } = useSummarize();

  const refreshKeyStatus = useCallback(async () => {
    setKeyStatus(await getKeyStatus());
  }, []);

  useEffect(() => {
    Promise.all([getKeyStatus(), getSettings()])
      .then(([keys, settings]) => {
        setKeyStatus(keys);
        setModel(startingModel(settings.model, keys));
        if (!keys.anthropic && !keys.openai) setShowOnboarding(true);
      })
      .catch(() => {
        setKeyStatus({ anthropic: false, openai: false });
        setShowOnboarding(true);
      });
  }, []);

  const handleModelChange = useCallback((next: string) => {
    setModel(next);
    void saveSettings({ model: next });
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

  if (keyStatus === null) return null;

  return (
    <div className="relative flex flex-col min-h-screen max-w-2xl mx-auto">
      <ParticleCanvas />
      <Header onOpenSettings={() => setShowSettings(true)} />

      <main className="flex-1 px-6 pb-6 space-y-4">
        <div className="sticky top-0 z-10 -mx-6 px-6 pt-2 pb-4 bg-background/95 backdrop-blur">
          <SummarizerForm
            model={model}
            keyStatus={keyStatus}
            isLoading={isLoading}
            onSubmit={submitUrl}
          />
        </div>

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
          <span>
            Built by{' '}
            <a href="https://rajatmehra.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Rajat Mehra</a>
          </span>
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
        <SettingsPanel
          keyStatus={keyStatus}
          model={model}
          onModelChange={handleModelChange}
          onClose={handleCloseSettings}
        />
      ) : null}
    </div>
  );
}
