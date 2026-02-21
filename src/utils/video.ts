import { VIDEO_ID_REGEX } from '@/constants';

function isYouTubeDomain(hostname: string): boolean {
  return hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com';
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  if (VIDEO_ID_REGEX.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (isYouTubeDomain(url.hostname)) {
      if (url.searchParams.has('v')) {
        const v = url.searchParams.get('v');
        if (v && VIDEO_ID_REGEX.test(v)) return v;
      }

      const pathPatterns = ['/embed/', '/shorts/', '/live/', '/v/'];
      for (const pattern of pathPatterns) {
        if (url.pathname.startsWith(pattern)) {
          const id = url.pathname.slice(pattern.length).split(/[/?]/)[0];
          if (id && VIDEO_ID_REGEX.test(id)) return id;
        }
      }
    }

    if (url.hostname === 'youtu.be') {
      const id = url.pathname.slice(1);
      if (VIDEO_ID_REGEX.test(id)) return id;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}
