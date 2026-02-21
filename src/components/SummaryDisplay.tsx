'use client';

import { memo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

interface SummaryDisplayProps {
  content: string;
  isLoading: boolean;
}

const SummaryDisplay = memo(function SummaryDisplay({ content, isLoading }: SummaryDisplayProps) {
  if (!content && !isLoading) return null;

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
  }, [content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'summary.md';
    a.click();
    URL.revokeObjectURL(url);
  }, [content]);

  return (
    <div className="glass-card p-6">
      {/* Actions */}
      {content ? (
        <div className="flex justify-end gap-2 mb-4">
          <button
            onClick={handleCopy}
            className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy
          </button>
          <button
            onClick={handleDownload}
            className="text-sm text-muted hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
        </div>
      ) : null}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-input-bg rounded w-3/4" />
          <div className="h-4 bg-input-bg rounded w-full" />
          <div className="h-4 bg-input-bg rounded w-5/6" />
          <div className="h-4 bg-input-bg rounded w-2/3" />
        </div>
      ) : (
        <div className="prose">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});

export default SummaryDisplay;
