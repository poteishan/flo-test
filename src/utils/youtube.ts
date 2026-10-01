export interface ParsedYouTubeInput {
  type: 'playlist' | 'video' | 'invalid';
  playlistId?: string;
  videoId?: string;
}

export function parseYouTubeInput(input: string): ParsedYouTubeInput {
  const trimmed = input.trim();
  if (!trimmed) return { type: 'invalid' };

  try {
    // Check if input is a raw playlist ID (typically starts with PL, UU, FL, RD, etc. and is 18-40 chars)
    if (/^[a-zA-Z0-9_-]{18,42}$/.test(trimmed) && trimmed.startsWith('PL')) {
      return { type: 'playlist', playlistId: trimmed };
    }

    // Check if input is a raw video ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return { type: 'video', videoId: trimmed };
    }

    // Parse URL
    let urlString = trimmed;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }

    const url = new URL(urlString);
    const host = url.hostname.replace('www.', '');

    // YouTube playlist page: youtube.com/playlist?list=...
    const listParam = url.searchParams.get('list');
    const vParam = url.searchParams.get('v');

    if (listParam) {
      return {
        type: 'playlist',
        playlistId: listParam,
        videoId: vParam || undefined,
      };
    }

    // YouTube watch URL: youtube.com/watch?v=...
    if (vParam) {
      return { type: 'video', videoId: vParam };
    }

    // Shortened URL: youtu.be/VIDEO_ID
    if (host === 'youtu.be') {
      const vid = url.pathname.slice(1).split('/')[0];
      if (vid && vid.length === 11) {
        return { type: 'video', videoId: vid };
      }
    }

    // Embed URL: youtube.com/embed/VIDEO_ID
    if (url.pathname.includes('/embed/')) {
      const parts = url.pathname.split('/embed/');
      const vid = parts[1]?.split('?')[0];
      if (vid && vid.length === 11) {
        return { type: 'video', videoId: vid };
      }
    }

    return { type: 'invalid' };
  } catch {
    return { type: 'invalid' };
  }
}

// Convert seconds into 00:00 or 00:00:00 string
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${paddedMins}:${paddedSecs}`;
}

// Convert timestamp string (e.g. "14:20" or "01:14:20") into seconds
export function parseTimestampToSeconds(ts: string): number | null {
  const parts = ts.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;

  if (parts.length === 2) {
    const [mins, secs] = parts;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const [hrs, mins, secs] = parts;
    return hrs * 3600 + mins * 60 + secs;
  }
  return null;
}
