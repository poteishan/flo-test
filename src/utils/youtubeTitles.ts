import type { VideoItem } from '../types';
import { CODER_ARMY_JAVA_57_VIDEOS } from '../data/javaCourseData';
import { PYTHON_MASTERCLASS_9_VIDEOS } from '../data/pythonCourseData';

// Cache to prevent duplicate network calls across views
const TITLE_CACHE = new Map<string, string>();
const DURATION_CACHE = new Map<string, string>();

// Seed cache and known database with known high-quality course catalogs
const KNOWN_VIDEOS = new Map<string, { title: string; duration: string }>();

CODER_ARMY_JAVA_57_VIDEOS.forEach(v => {
  if (v.youtubeId) {
    const dur = v.duration || '20:00';
    KNOWN_VIDEOS.set(v.youtubeId, { title: v.title, duration: dur });
    TITLE_CACHE.set(v.youtubeId, v.title);
    DURATION_CACHE.set(v.youtubeId, dur);
  }
});

PYTHON_MASTERCLASS_9_VIDEOS.forEach(v => {
  if (v.youtubeId) {
    const dur = v.duration || '20:00';
    KNOWN_VIDEOS.set(v.youtubeId, { title: v.title, duration: dur });
    TITLE_CACHE.set(v.youtubeId, v.title);
    DURATION_CACHE.set(v.youtubeId, dur);
  }
});

/**
 * Check if a title is generic (e.g. "Lecture 06", "Lecture 12", "01. Loading course playlist...")
 */
export function isGenericLectureTitle(title: string): boolean {
  if (!title) return true;
  const trimmed = title.trim();
  return (
    trimmed.startsWith('Lecture') ||
    trimmed.includes('Loading course') ||
    trimmed.includes('Orientation Module') ||
    trimmed.includes('Capstone Project') ||
    /^(Lecture\s*\d+|\d+\.\s*Lecture\s*\d+)$/i.test(trimmed)
  );
}

/**
 * Instantly enriches video list with known catalog titles & durations (0ms synchronous)
 */
export function enrichVideosWithKnownData(videos: VideoItem[], playlistId?: string): VideoItem[] {
  if (!videos || videos.length === 0) return videos;

  const isJava = playlistId === 'PLQEaRBV9gAFsR15tNo2QLF9d2qc-c018p' ||
    videos.some(v => v.youtubeId === 'LBqE4YOvhyc' || v.youtubeId === 'pdS8_smlsXA' || v.youtubeId === 'NtmULLvsABc');
  const isPython = playlistId === 'PLGjplNEQ1it8-0CmoljS5yeV-GlKSUEt0' ||
    videos.some(v => v.youtubeId === '4tS007_qRVI' || v.youtubeId === 'J1c_iH_x69U' || v.youtubeId === 't2_Q2BRzeEE');

  return videos.map((v, idx) => {
    let known = v.youtubeId ? KNOWN_VIDEOS.get(v.youtubeId) : undefined;
    if (!known && isJava && CODER_ARMY_JAVA_57_VIDEOS[idx]) {
      known = {
        title: CODER_ARMY_JAVA_57_VIDEOS[idx].title,
        duration: CODER_ARMY_JAVA_57_VIDEOS[idx].duration || '20:00',
      };
    } else if (!known && isPython && PYTHON_MASTERCLASS_9_VIDEOS[idx]) {
      known = {
        title: PYTHON_MASTERCLASS_9_VIDEOS[idx].title,
        duration: PYTHON_MASTERCLASS_9_VIDEOS[idx].duration || '20:00',
      };
    }

    const fallbackYtId = isJava 
      ? CODER_ARMY_JAVA_57_VIDEOS[idx]?.youtubeId 
      : (isPython ? PYTHON_MASTERCLASS_9_VIDEOS[idx]?.youtubeId : undefined);
    const finalYtId = v.youtubeId || fallbackYtId || v.youtubeId;

    if (!known) {
      if (finalYtId && TITLE_CACHE.has(finalYtId)) {
        const cachedTitle = TITLE_CACHE.get(finalYtId)!;
        const cachedDur = DURATION_CACHE.get(finalYtId) || v.duration;
        return {
          ...v,
          youtubeId: finalYtId,
          title: isGenericLectureTitle(v.title) ? cachedTitle : v.title,
          duration: (!v.duration || v.duration === '20:00' || v.duration === '--:--') ? cachedDur : v.duration,
        };
      }
      return v;
    }

    const needsTitle = !v.title || isGenericLectureTitle(v.title);
    const needsDuration = !v.duration || v.duration === '--:--' || v.duration === '20:00';

    if (needsTitle || needsDuration || (!v.youtubeId && finalYtId)) {
      return {
        ...v,
        youtubeId: finalYtId,
        title: needsTitle ? known.title : v.title,
        duration: needsDuration ? known.duration : v.duration,
      };
    }
    return v;
  });
}

/**
 * Fetch real video title with high-speed parallel noembed + oEmbed fallback
 */
export async function fetchYouTubeVideoTitle(videoId: string): Promise<string | null> {
  if (!videoId || videoId.length !== 11) return null;

  if (TITLE_CACHE.has(videoId)) {
    return TITLE_CACHE.get(videoId)!;
  }

  // 1. High-speed noembed API (CORS enabled, highly reliable, avoids YouTube 429 limits)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        const cleanTitle = data.title.trim();
        TITLE_CACHE.set(videoId, cleanTitle);
        return cleanTitle;
      }
    }
  } catch {
    // Fall back to official oembed
  }

  // 2. Official YouTube oEmbed API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        const cleanTitle = data.title.trim();
        TITLE_CACHE.set(videoId, cleanTitle);
        return cleanTitle;
      }
    }
  } catch {
    // Both failed
  }

  return null;
}

// Metadata older than this is re-fetched from YouTube rather than trusted indefinitely
const METADATA_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * True when a video's title/duration were never fetched from YouTube, or were fetched
 * more than 30 days ago and should be refreshed rather than stored indefinitely.
 */
export function needsMetadataRefresh(video: VideoItem): boolean {
  if (!video.youtubeId) return false;
  if (!video.metadataFetchedAt) return true;
  return Date.now() - video.metadataFetchedAt > METADATA_MAX_AGE_MS;
}

/**
 * Resolve and populate real YouTube titles and durations for any list of videos
 */
export async function resolvePlaylistTitles(
  videos: VideoItem[],
  onChunkUpdate?: (updatedList: VideoItem[]) => void
): Promise<VideoItem[]> {
  if (!videos || videos.length === 0) return videos;

  // 1. Instant synchronous check against known masterclasses (Coder Army 57, Python 9, etc.)
  let currentVideos = enrichVideosWithKnownData(videos);
  let hasAnyChanges = JSON.stringify(currentVideos) !== JSON.stringify(videos);

  if (hasAnyChanges && onChunkUpdate) {
    onChunkUpdate([...currentVideos]);
  }

  // 2. Identify remaining generic titles, or titles whose metadata is stale (30+ days), for network resolution
  const itemsToFetch: { index: number; video: VideoItem }[] = [];
  currentVideos.forEach((v, index) => {
    if (v.youtubeId && (isGenericLectureTitle(v.title) || needsMetadataRefresh(v))) {
      itemsToFetch.push({ index, video: v });
    }
  });

  if (itemsToFetch.length === 0) {
    return currentVideos;
  }

  // 3. Fetch in parallel batches of 8 for maximum speed without browser connection stalling
  const BATCH_SIZE = 8;
  for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
    const batch = itemsToFetch.slice(i, i + BATCH_SIZE);
    let batchChanged = false;

    await Promise.all(
      batch.map(async ({ index, video }) => {
        const rawTitle = await fetchYouTubeVideoTitle(video.youtubeId);
        if (rawTitle) {
          const num = index + 1;
          const prefix = `${String(num).padStart(2, '0')}. `;
          const formattedTitle = rawTitle.startsWith(`${num}.`) || rawTitle.startsWith(prefix)
            ? rawTitle
            : `${prefix}${rawTitle}`;

          const cachedDur = DURATION_CACHE.get(video.youtubeId);
          currentVideos[index] = {
            ...currentVideos[index],
            title: formattedTitle,
            duration: (cachedDur && (!currentVideos[index].duration || currentVideos[index].duration === '20:00' || currentVideos[index].duration === '--:--'))
              ? cachedDur
              : currentVideos[index].duration,
            metadataFetchedAt: Date.now(),
          };
          batchChanged = true;
          hasAnyChanges = true;
        }
      })
    );

    if (batchChanged && onChunkUpdate) {
      onChunkUpdate([...currentVideos]);
    }
  }

  return currentVideos;
}
