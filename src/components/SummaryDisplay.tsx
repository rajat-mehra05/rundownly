'use client';

import { memo, useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

const TIMESTAMP_REGEX = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

function renderTimestampLinks(text: string, videoId?: string): ReactNode[] {
  if (!videoId) return [text];

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = new RegExp(TIMESTAMP_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const ts = match[1];
    const seconds = parseTimestampToSeconds(ts);
    parts.push(
      <a
        key={`${match.index}-${ts}`}
        href={`https://www.youtube.com/watch?v=${videoId}&t=${seconds}`}
        target="_blank"
        rel="noopener noreferrer"
        className="timestamp-link"
      >
        {match[0]}
      </a>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

function stripTimestamps(children: ReactNode): ReactNode {
  if (typeof children === 'string') {
    return children.replace(TIMESTAMP_REGEX, '').replace(/\s{2,}/g, ' ').trim();
  }
  if (Array.isArray(children)) {
    return children
      .map((child) =>
        typeof child === 'string'
          ? child.replace(TIMESTAMP_REGEX, '').replace(/\s{2,}/g, ' ').trim()
          : child
      )
      .filter((child) => child !== '');
  }
  return children;
}

function processChildren(children: ReactNode, videoId?: string): ReactNode {
  if (!videoId || !children) return children;

  if (typeof children === 'string') {
    const result = renderTimestampLinks(children, videoId);
    return result.length === 1 && typeof result[0] === 'string' ? result[0] : <>{result}</>;
  }

  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === 'string') {
        const result = renderTimestampLinks(child, videoId);
        return result.length === 1 && typeof result[0] === 'string'
          ? result[0]
          : <span key={i}>{result}</span>;
      }
      return child;
    });
  }

  return children;
}

interface SummaryDisplayProps {
  content: string;
  isLoading: boolean;
  videoId?: string;
}

const SummaryDisplay = memo(function SummaryDisplay({ content, isLoading, videoId }: SummaryDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleDownload = useCallback(async () => {
    try {
      const defaultName = videoId ? `rundownly-${videoId}.md` : 'rundownly-summary.md';
      const filePath = await save({
        defaultPath: defaultName,
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, content);
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      setSaved(true);
      savedTimeoutRef.current = setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      setSaved(false);
      console.error('Failed to save file:', err);
    }
  }, [content, videoId]);

  const markdownComponents = useMemo(() => ({
    h1: ({ children }: { children?: ReactNode }) => (
      <h1>{stripTimestamps(children)}</h1>
    ),
    h2: ({ children }: { children?: ReactNode }) => (
      <h2>{stripTimestamps(children)}</h2>
    ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3>{stripTimestamps(children)}</h3>
    ),
    p: ({ children }: { children?: ReactNode }) => (
      <p>{processChildren(children, videoId)}</p>
    ),
    li: ({ children }: { children?: ReactNode }) => (
      <li>{processChildren(children, videoId)}</li>
    ),
    strong: ({ children }: { children?: ReactNode }) => (
      <strong>{processChildren(children, videoId)}</strong>
    ),
  }), [videoId]);

  if (!content && !isLoading) return null;

  return (
    <div className="glass-card summary-card">
      {/* Header */}
      <div className="summary-card-header">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Summary
        </div>
        {content && !isLoading ? (
          <div className="flex gap-1">
            <button
              onClick={handleCopy}
              className="summary-action-btn"
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              )}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="summary-action-btn"
            >
              {saved ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              )}
              {saved ? 'Saved!' : 'Download'}
            </button>
          </div>
        ) : null}
      </div>

      {/* Content */}
      {isLoading && !content ? (
        <div className="summary-loading">
          <span className="summary-loading-text">Generating summary...</span>
          <div className="summary-skeleton">
            <div className="summary-skeleton-line" />
            <div className="summary-skeleton-line" />
            <div className="summary-skeleton-line" />
            <div className="summary-skeleton-line" />
          </div>
        </div>
      ) : (
        <div className="prose-summary">
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
});

export default SummaryDisplay;
