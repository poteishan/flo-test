import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime } from '../utils/youtube';
import type { VideoItem } from '../types';
import { 
  SkipBack, 
  SkipForward, 
  CheckCircle2,
  Clock,
  Play,
  Pause,
  BookmarkPlus,
  Sparkles,
  FolderPlus,
  RotateCcw,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import { resolvePlaylistTitles, isGenericLectureTitle, enrichVideosWithKnownData } from '../utils/youtubeTitles';
import { WorkspaceAdBanner } from './WorkspaceAdBanner';
import { WorkspaceRightPanel } from './WorkspaceRightPanel';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const PlayerWorkspace: React.FC = () => {
  const {
    activeCourse,
    activeVideo,
    activeVideoId,
    setActiveVideoId,
    toggleVideoCompletion,
    setVideoCompleted,
    setYtPlayer,
    saveNoteForCurrentVideo,
    getNoteForCurrentVideo,
    setIsAddModalOpen,
    updateCourseVideos,
    updateVideoDuration,
    savePlaybackPosition,
    getPlaybackPosition,
    clearPlaybackPosition,
    setCurrentView,
    setWorkspaceRightTab,
    isRightPanelOpen,
    setIsRightPanelOpen,
    setPlayerState,
  } = useApp();

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerInstanceRef = useRef<any>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number>(0);
  const [playerStatus, setPlayerStatus] = useState<'playing' | 'paused' | 'ready' | 'loading'>('loading');
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState<boolean>(false);
  
  // Persistent Playback & Auto-completion Feedback
  const [resumeBanner, setResumeBanner] = useState<{ seconds: number; formatted: string } | null>(null);
  const [completionToast, setCompletionToast] = useState<string | null>(null);
  const hasAttemptedResumeRef = useRef<string | null>(null);
  const lastSavedSecRef = useRef<number>(0);
  const lastLoadedVideoKeyRef = useRef<string | null>(null);

  const activeCourseRef = useRef(activeCourse);
  const activeVideoRef = useRef(activeVideo);
  useEffect(() => {
    activeCourseRef.current = activeCourse;
    activeVideoRef.current = activeVideo;
  }, [activeCourse, activeVideo]);

  // "F" toggles fullscreen on the YouTube player itself, so its own controls (including
  // its exit-fullscreen button) stay in charge. When the video iframe has focus, YouTube's
  // built-in "F" shortcut handles the key instead, since keystrokes go into the iframe.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignore if user is typing in an input, textarea, contenteditable, or rich text editor (Tiptap / ProseMirror)
      if (
        !target ||
        target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        Boolean(target.closest?.('[contenteditable="true"]')) ||
        Boolean(target.closest?.('.ProseMirror')) ||
        Boolean(target.closest?.('.tiptap'))
      ) {
        return;
      }

      // Do not trigger if Ctrl/Cmd/Alt is pressed (e.g. browser Ctrl+F search)
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.key.toLowerCase() !== 'f') return;

      const iframe: HTMLIFrameElement | null =
        playerInstanceRef.current?.getIframe?.() || document.getElementById('youtube-player-element') as HTMLIFrameElement | null;
      if (!iframe || iframe.tagName !== 'IFRAME') return;

      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        iframe.requestFullscreen?.().catch(() => {});
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);


  const currentIndex = activeCourse ? activeCourse.videos.findIndex(v => v.id === activeVideoId) : -1;
  const hasPrevious = currentIndex > 0;
  const hasNext = activeCourse ? currentIndex < activeCourse.videos.length - 1 : false;

  // Check and resume playback position (isolated by courseId and videoId)
  const checkAndResumePlayback = useCallback((player: any) => {
    const curCourse = activeCourseRef.current;
    const curVideo = activeVideoRef.current;
    if (!curCourse || !curVideo || !player || typeof player.seekTo !== 'function') return;
    const trackingKey = `${curCourse.id}::${curVideo.id}`;
    if (hasAttemptedResumeRef.current === trackingKey) return;
    hasAttemptedResumeRef.current = trackingKey;

    // Edge case: if video is explicitly marked completed, clear and start from 0
    if (curVideo.completed) {
      clearPlaybackPosition(curCourse.id, curVideo.id);
      return;
    }

    const savedSec = getPlaybackPosition(curCourse.id, curVideo.id);

    // Only resume if saved position > 5 seconds
    if (savedSec > 5) {
      try {
        if (typeof player.cueVideoById === 'function') {
          player.cueVideoById({
            videoId: curVideo.youtubeId,
            startSeconds: savedSec,
          });
        } else {
          player.seekTo(savedSec, false);
        }
        setResumeBanner({ seconds: savedSec, formatted: formatTime(savedSec) });
        setTimeout(() => {
          setResumeBanner(curr => (curr?.seconds === savedSec ? null : curr));
        }, 8000);
      } catch (e) {
        console.warn('Playback resume notice:', e);
      }
    }
  }, [getPlaybackPosition, clearPlaybackPosition]);

  // "Start Over" user action
  const handleStartOver = useCallback(() => {
    const curCourse = activeCourseRef.current;
    const curVideo = activeVideoRef.current;
    if (playerInstanceRef.current && typeof playerInstanceRef.current.seekTo === 'function') {
      playerInstanceRef.current.seekTo(0, true);
    }
    if (curCourse && curVideo) {
      clearPlaybackPosition(curCourse.id, curVideo.id);
      lastSavedSecRef.current = 0;
    }
    setResumeBanner(null);
  }, [clearPlaybackPosition]);

  // Toggle Play / Pause
  const togglePlayPause = () => {
    if (playerInstanceRef.current) {
      if (playerStatus === 'playing') {
        playerInstanceRef.current.pauseVideo();
      } else {
        playerInstanceRef.current.playVideo();
      }
    }
  };

  // Sync real playlist videos from YouTube iFrame API
  const syncPlaylistIfAvailable = useCallback((player: any) => {
    const curCourse = activeCourseRef.current;
    if (!curCourse?.playlistId || !player) return;
    try {
      const playlist: string[] = typeof player.getPlaylist === 'function' ? player.getPlaylist() : [];
      const videoData = typeof player.getVideoData === 'function' ? player.getVideoData() : null;

      if (playlist && playlist.length > 0) {
        const hasDummyId = curCourse.videos.some(v => v.youtubeId === 'dQw4w9WgXcQ' || !v.youtubeId);
        const hasGenericTitles = curCourse.videos.some(v => isGenericLectureTitle(v.title));
        const hasGenericDurations = curCourse.videos.some(v => !v.duration || v.duration === '20:00' || v.duration === '--:--');
        const needsUpdate = hasDummyId || curCourse.videos.length !== playlist.length || hasGenericTitles || hasGenericDurations;

        if (needsUpdate) {
          const rawVideos: VideoItem[] = playlist.map((vId, idx) => {
            const existing = curCourse.videos.find(v => v.youtubeId === vId) || curCourse.videos[idx];
            const isFirst = idx === 0;
            const title = (isFirst && videoData?.title) 
              ? `${String(idx + 1).padStart(2, '0')}. ${videoData.title}`
              : existing?.title && !isGenericLectureTitle(existing.title)
              ? existing.title
              : `Lecture ${String(idx + 1).padStart(2, '0')}`;

            return {
              id: existing?.id || `vid-${curCourse.id}-${idx}`,
              youtubeId: vId,
              title,
              duration: existing?.duration && existing.duration !== '--:--' ? existing.duration : '20:00',
              completed: existing?.completed || false,
            };
          });

          // 1. INSTANT synchronous enrichment (0ms) - Known catalogs and cached videos resolve immediately
          const enrichedVideos = enrichVideosWithKnownData(rawVideos, curCourse.playlistId);
          updateCourseVideos(curCourse.id, enrichedVideos);

          if (!activeVideoRef.current?.id || curCourse.videos.length <= 1) {
            setActiveVideoId(enrichedVideos[0].id);
          }

          // 2. High-speed parallel resolution via official oEmbed/noembed lookups
          resolvePlaylistTitles(enrichedVideos, (resolved) => {
            updateCourseVideos(curCourse.id, resolved);
          });
        }
      }
    } catch (e) {
      console.warn('Playlist sync notice:', e);
    }
  }, [updateCourseVideos, setActiveVideoId]);

  // Sync currently playing video's real title & duration from player
  const syncVideoMetadata = useCallback((player: any) => {
    const curCourse = activeCourseRef.current;
    const curVideoId = activeVideoRef.current?.id;
    if (!curCourse || !player) return;
    try {
      const vData = typeof player.getVideoData === 'function' ? player.getVideoData() : null;
      if (!vData || !vData.title) return;

      const pIndex = typeof player.getPlaylistIndex === 'function' ? player.getPlaylistIndex() : -1;
      const targetIdx = pIndex >= 0 ? pIndex : curCourse.videos.findIndex(v => v.id === curVideoId);

      if (targetIdx >= 0 && curCourse.videos[targetIdx]) {
        const vid = curCourse.videos[targetIdx];
        const isGeneric = isGenericLectureTitle(vid.title);
        const rawDur = typeof player.getDuration === 'function' ? Math.floor(player.getDuration()) : 0;
        const durStr = rawDur > 0 ? formatTime(rawDur) : null;
        const needsDuration = durStr && (!vid.duration || vid.duration === '20:00' || vid.duration === '--:--');

        if (isGeneric || !vid.title.includes(vData.title) || needsDuration) {
          const updated = [...curCourse.videos];
          const prefix = `${String(targetIdx + 1).padStart(2, '0')}. `;
          const formatted = vData.title.startsWith(prefix) ? vData.title : `${prefix}${vData.title}`;
          updated[targetIdx] = {
            ...vid,
            youtubeId: vData.video_id || vid.youtubeId,
            title: isGeneric || !vid.title.includes(vData.title) ? formatted : vid.title,
            duration: needsDuration && durStr ? durStr : vid.duration,
          };
          updateCourseVideos(curCourse.id, updated);
        }
      }
    } catch {}
  }, [updateCourseVideos]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    let checkInterval: number;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player || !playerContainerRef.current) return;

      if (playerInstanceRef.current && typeof playerInstanceRef.current.loadVideoById === 'function') {
        return;
      }
      const playerConfig: any = {
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
          playsinline: 1,
          origin: window.location.origin,
          fs: 1,
        },
        events: {
          onReady: (event: any) => {
            setYtPlayer(event.target);
            setPlayerStatus('ready');
            try {
              event.target.pauseVideo?.();
              const dur = typeof event.target.getDuration === 'function' ? Math.floor(event.target.getDuration()) : 0;
              if (dur > 0) {
                setVideoDurationSec(dur);
                const curCourse = activeCourseRef.current;
                const curVideo = activeVideoRef.current;
                if (curCourse && curVideo) {
                  const formattedDur = formatTime(dur);
                  if (!curVideo.duration || curVideo.duration === '20:00' || curVideo.duration === '--:--') {
                    updateVideoDuration(curCourse.id, curVideo.id, formattedDur);
                  }
                }
              }
              const iframe = event.target.getIframe?.() || document.querySelector('#youtube-player-element');
              if (iframe) {
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen');
                iframe.setAttribute('allowfullscreen', 'true');
              }
            } catch {}
            syncPlaylistIfAvailable(event.target);
            checkAndResumePlayback(event.target);
          },
          onStateChange: (event: any) => {
            if (event.data === 1) {
              setPlayerStatus('playing');
              setPlayerState('playing');
              syncVideoMetadata(event.target);
              // Video is actively playing: never call checkAndResumePlayback or cue/seek here
            } else if (event.data === 2) {
              setPlayerStatus('paused');
              setPlayerState('paused');
              const curCourse = activeCourseRef.current;
              const curVideo = activeVideoRef.current;
              // Save exact offset on pause
              if (curCourse && curVideo && typeof event.target.getCurrentTime === 'function') {
                const pSec = Math.floor(event.target.getCurrentTime());
                if (pSec > 3) {
                  savePlaybackPosition(curCourse.id, curVideo.id, pSec);
                  lastSavedSecRef.current = pSec;
                }
              }
            } else if (event.data === 0) {
              // Video ended -> Auto mark completed & clear saved position
              setPlayerStatus('paused');
              setPlayerState('paused');
              const curCourse = activeCourseRef.current;
              const curVideo = activeVideoRef.current;
              if (curCourse && curVideo) {
                setVideoCompleted(curCourse.id, curVideo.id, true);
                clearPlaybackPosition(curCourse.id, curVideo.id);
                setCompletionToast('Lecture completed! 🎉');
                setTimeout(() => setCompletionToast(null), 12000); // 12 seconds to allow clicking next
              }
            }
          },
        },
      };

      const curCourse = activeCourseRef.current;
      const curVideo = activeVideoRef.current;
      const hasDummyId = curCourse?.videos?.some(v => v.youtubeId === 'dQw4w9WgXcQ' || !v.youtubeId);
      const needsPlaylistSync = curCourse?.playlistId && (hasDummyId || curCourse.videos.length <= 1);

      if (needsPlaylistSync) {
        playerConfig.playerVars.listType = 'playlist';
        playerConfig.playerVars.list = curCourse.playlistId;
      } else if (curVideo?.youtubeId) {
        playerConfig.videoId = curVideo.youtubeId;
      }

      playerInstanceRef.current = new window.YT.Player('youtube-player-element', playerConfig);
      setYtPlayer(playerInstanceRef.current);
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else {
      initPlayer();
    }

    // Polling current playback time (1s tick) for accurate time display and 2-3s auto-save
    checkInterval = window.setInterval(() => {
      if (playerInstanceRef.current && typeof playerInstanceRef.current.getCurrentTime === 'function') {
        try {
          const t = playerInstanceRef.current.getCurrentTime();
          const sec = Math.floor(t);
          setCurrentTimeSec(sec);

          const dur = typeof playerInstanceRef.current.getDuration === 'function' 
            ? Math.floor(playerInstanceRef.current.getDuration()) 
            : 0;
          if (dur > 0) {
            setVideoDurationSec(dur);
          }

          const curCourse = activeCourseRef.current;
          const curVideo = activeVideoRef.current;

          if (curCourse && curVideo && dur > 0) {
            const formattedDur = formatTime(dur);
            if (!curVideo.duration || curVideo.duration === '20:00' || curVideo.duration === '--:--') {
              updateVideoDuration(curCourse.id, curVideo.id, formattedDur);
            }

            // Periodically save every 2-3 seconds during active playback
            if (!curVideo.completed && sec > 3) {
              if (Math.abs(sec - lastSavedSecRef.current) >= 2) {
                savePlaybackPosition(curCourse.id, curVideo.id, sec);
                lastSavedSecRef.current = sec;
              }
            }
          }
        } catch {}
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
    };
  }, [
    activeCourse?.id, 
    activeCourse?.playlistId, 
    setYtPlayer, 
    setVideoCompleted,
    clearPlaybackPosition,
    syncPlaylistIfAvailable, 
    syncVideoMetadata,
    checkAndResumePlayback,
    savePlaybackPosition,
    updateVideoDuration
  ]);

  // Load new video when activeVideo changes
  useEffect(() => {
    if (!playerInstanceRef.current || !activeVideo?.youtubeId) return;

    const currentKey = `${activeCourse?.id || ''}::${activeVideo.id}::${activeVideo.youtubeId}`;
    if (lastLoadedVideoKeyRef.current === currentKey) {
      return; // Already loaded this exact video, do not interrupt playback!
    }
    lastLoadedVideoKeyRef.current = currentKey;

    hasAttemptedResumeRef.current = null; // Reset for new video
    lastSavedSecRef.current = 0;
    setResumeBanner(null);

    // If the player is already ready and has methods
    if (typeof playerInstanceRef.current.cueVideoById === 'function') {
      const currentPlaylistIndex = playerInstanceRef.current.getPlaylistIndex?.();
      const targetIdx = activeCourse?.videos.findIndex(v => v.id === activeVideo.id) ?? -1;
      
      // If the player is currently running a playlist and we need to jump within it
      if (currentPlaylistIndex !== undefined && currentPlaylistIndex !== -1 && targetIdx !== -1 && currentPlaylistIndex !== targetIdx) {
        playerInstanceRef.current.cueVideoAt?.(targetIdx);
      } else {
        // Use cueVideoById to prevent auto-starting video without user action
        const savedSec = getPlaybackPosition(activeCourse?.id || '', activeVideo.id);
        if (savedSec > 5 && !activeVideo.completed) {
          playerInstanceRef.current.cueVideoById?.({
            videoId: activeVideo.youtubeId,
            startSeconds: savedSec,
          });
          setResumeBanner({ seconds: savedSec, formatted: formatTime(savedSec) });
          hasAttemptedResumeRef.current = `${activeCourse?.id}::${activeVideo.id}`;
        } else {
          playerInstanceRef.current.cueVideoById?.(activeVideo.youtubeId);
        }
      }
    }
  }, [activeCourse?.id, activeVideo?.id, activeVideo?.youtubeId, activeVideo?.completed, getPlaybackPosition]);

  const handlePrevious = () => {
    if (hasPrevious && activeCourse) {
      setActiveVideoId(activeCourse.videos[currentIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (hasNext && activeCourse) {
      setActiveVideoId(activeCourse.videos[currentIndex + 1].id);
    }
  };

  // Quick timestamp note insertion
  const handleQuickTimestampNote = useCallback(() => {
    let currentSec = 0;
    if (playerInstanceRef.current && typeof playerInstanceRef.current.getCurrentTime === 'function') {
      currentSec = Math.floor(playerInstanceRef.current.getCurrentTime());
    }
    const formatted = formatTime(currentSec);
    const existing = getNoteForCurrentVideo();
    const tag = `<p><br></p><p>▶ [${formatted}] </p>`;
    saveNoteForCurrentVideo({ content: existing.content + tag });
    // Reveal notes tab in the right panel
    setWorkspaceRightTab('notes');
    setIsRightPanelOpen(true);
  }, [getNoteForCurrentVideo, saveNoteForCurrentVideo, setWorkspaceRightTab, setIsRightPanelOpen]);

  if (!activeCourse || !activeVideo) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#F9F8F5]">
        <div className="max-w-md p-8 rounded-3xl bg-white border-2 border-[#121417] shadow-solid-lg flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[#EBF755] border-2 border-[#121417] text-[#121417] flex items-center justify-center mb-5 shadow-solid">
            <FolderPlus className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-extrabold text-[#121417] mb-2 tracking-tight">
            Ready to Start Learning?
          </h2>

          <p className="text-xs text-[#121417]/70 mb-6 leading-relaxed font-medium">
            Your learning workspace is clean and ready. Add any YouTube playlist or video link to track lectures, take timestamped notes, and build your daily study streak.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView('playlists')}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#121417] bg-white hover:bg-slate-50 border-2 border-[#121417] shadow-sm transition-all"
            >
              <LayoutGrid className="w-3.5 h-3.5 inline mr-1.5" />
              <span>View All Playlists</span>
            </button>

            <button
              id="tour-empty-add-course-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#121417] bg-[#D4E4FC] hover:bg-[#C2DBFB] border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Add Course</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[#F9F8F5] overflow-y-auto">
      {/* Player Container - Expands to fill available width with no empty gutters */}
      <div className="pt-3 sm:pt-4 lg:pt-6 pb-6 pl-3 sm:pl-4 lg:pl-6 pr-2 sm:pr-3 lg:pr-4 w-full">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <button
            onClick={() => setCurrentView('playlists')}
            className="flex items-center gap-1.5 text-xs font-bold text-[#121417]/70 hover:text-[#121417] transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>All Playlists</span>
            <span className="text-[#121417]/40">/</span>
            <span className="text-[#121417] font-extrabold truncate max-w-[180px] sm:max-w-[280px] xl:max-w-[400px]">
              {activeCourse.title}
            </span>
          </button>
        </div>

        {/* Dynamic Alert Toasts: Playback Resume with "Start Over" & Completion Notification */}
        {completionToast && (
          <div className="animate-fade-in flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#EBF755] text-black border-2 border-[#121417] shadow-solid mb-3">
            <div className="flex items-center gap-2 text-xs font-black">
              <Sparkles className="w-4 h-4 fill-current text-black" />
              <span>{completionToast}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasNext && (
                <button
                  onClick={() => {
                    handleNext();
                    setCompletionToast(null);
                  }}
                  className="px-3 py-1 rounded-full text-[11px] font-black bg-[#121417] text-white hover:bg-black transition-all shadow-xs active:scale-95"
                >
                  Start Next Lecture <SkipForward className="w-3 h-3 inline ml-0.5" />
                </button>
              )}
              <button
                onClick={() => setCompletionToast(null)}
                className="text-black/60 hover:text-black p-1 text-xs font-black ml-1"
                title="Close"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {resumeBanner && (
          <div className="animate-fade-in flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid mb-3">
            <div className="flex items-center gap-2 text-xs font-bold">
              <RotateCcw className="w-4 h-4 text-[#EBF755]" />
              <span>Resumed playback from <strong className="underline decoration-[#EBF755] font-mono text-white ml-0.5">{resumeBanner.formatted}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleStartOver}
                className="px-3 py-1 rounded-full text-xs font-black bg-[#EBF755] text-black hover:bg-white transition-all shadow-xs active:scale-95"
              >
                Start Over
              </button>
              <button
                onClick={() => setResumeBanner(null)}
                className="text-white/60 hover:text-white p-1 text-xs"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 16:9 Responsive Video Aspect Ratio */}
        <div id="tour-video-player" className="relative w-full rounded-2xl 2xl:rounded-3xl overflow-hidden aspect-video group border-2 border-[#121417] shadow-solid bg-black">
          <div id="youtube-player-element" ref={playerContainerRef} className="w-full h-full" />
        </div>

        {/* Video Information & Action Controls */}
        <div className="mt-3 xl:mt-5 p-3.5 sm:p-4 2xl:p-5 rounded-2xl 2xl:rounded-3xl bg-white border-2 border-[#121417] shadow-solid">
          {/* Primary Control Bar: Previous / Play / Next / Speed / Fullscreen */}
          <div className={`flex items-center justify-between gap-1 sm:gap-2 flex-nowrap ${
            isControlsExpanded ? 'mb-4 pb-3.5 border-b border-[#121417]/10' : 'lg:mb-4 lg:pb-3.5 lg:border-b lg:border-[#121417]/10'
          }`}>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={handlePrevious}
                disabled={!hasPrevious}
                title="Previous"
                className={`flex items-center justify-center p-2 sm:px-3 sm:py-1.5 rounded-full border transition-colors ${
                  hasPrevious
                    ? 'bg-white border-[#121417]/30 text-[#121417] hover:bg-slate-100'
                    : 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                }`}
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlayPause}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#121417] text-white hover:bg-[#121417]/80 transition-colors shadow-sm flex-shrink-0"
                title={playerStatus === 'playing' ? "Pause" : "Play"}
              >
                {playerStatus === 'playing' ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleNext}
                disabled={!hasNext}
                title="Next"
                className={`flex items-center justify-center p-2 sm:px-3 sm:py-1.5 rounded-full border transition-colors ${
                  hasNext
                    ? 'bg-white border-[#121417]/30 text-[#121417] hover:bg-slate-100'
                    : 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                }`}
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Expand/Collapse Details Toggle - Mobile/Tablet only (desktop always shows details) */}
              <button
                onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                className="lg:hidden p-1.5 sm:p-2 rounded-full bg-white hover:bg-slate-50 border border-[#121417]/30 text-[#121417] transition-colors"
                title={isControlsExpanded ? "Collapse lecture details" : "Expand lecture details"}
              >
                <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isControlsExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          <div className={`${isControlsExpanded ? 'flex' : 'hidden'} lg:flex flex-col md:flex-row md:items-center justify-between gap-4`}>
            {/* Title & Metadata */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#D4E4FC] text-[#121417] border border-[#121417]/15">
                  Lecture {currentIndex + 1} of {activeCourse.videos.length}
                </span>
                <span className="flex items-center gap-1.5 text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#F9F8F5] border border-[#121417]/15 text-[#121417]/70 font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    playerStatus === 'playing' ? 'bg-emerald-500 animate-ping' : playerStatus === 'paused' ? 'bg-amber-500' : 'bg-slate-400'
                  }`} />
                  {playerStatus}
                </span>
                {videoDurationSec > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-[#121417]/70 font-mono font-bold">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(currentTimeSec)} / {formatTime(videoDurationSec)}</span>
                  </span>
                )}
                {activeVideo.completed && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                    <Sparkles className="w-3 h-3" /> Completed
                  </span>
                )}
              </div>

              <h1 id="tour-video-title" className="text-sm sm:text-base 2xl:text-lg font-extrabold text-[#121417] tracking-tight leading-snug line-clamp-2">
                {activeVideo.title}
              </h1>
              <p className="text-xs text-[#121417]/60 mt-1 font-bold">
                Course: <span className="text-[#121417]">{activeCourse.title}</span>
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
              {/* Timestamp Note Quick Button */}
              <button
                id="tour-quick-timestamp-btn"
                onClick={handleQuickTimestampNote}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-white hover:bg-[#EBF755]/20 text-[#121417] text-xs font-black border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                title="Insert current video timestamp into notes"
              >
                <BookmarkPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Timestamp Note [{formatTime(currentTimeSec)}]</span>
              </button>

              {/* Mark Completed Toggle */}
              <button
                onClick={() => toggleVideoCompletion(activeCourse.id, activeVideo.id)}
                className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs font-black border-2 border-[#121417] transition-all hover:scale-105 active:scale-95 whitespace-nowrap ${
                  activeVideo.completed
                    ? 'bg-[#EBF755] text-black shadow-solid'
                    : 'bg-white text-[#121417] hover:bg-[#EBF755]/30 shadow-solid-xs'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{activeVideo.completed ? 'Completed' : 'Mark as Done'}</span>
              </button>
            </div>
          </div>

          {/* YouTube-style Description & Course Info Box */}
          <div className={`${isControlsExpanded ? 'block' : 'hidden'} lg:block mt-3.5 p-3.5 rounded-2xl bg-[#F9F8F5] border border-[#121417]/10 text-xs`}>
            <div className="flex items-center justify-between font-bold text-[#121417]/70">
              <span className="font-extrabold text-[#121417]">
                {activeCourse.videos.length} Lectures Total • {activeCourse.videos.filter(v => v.completed).length} Completed
              </span>
              <button 
                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                className="text-[#121417] hover:underline font-extrabold flex items-center gap-0.5 text-[11px] p-1"
              >
                <span>{isDescriptionExpanded ? 'Show less' : '...more'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {isDescriptionExpanded && (
              <div className="mt-2.5 text-[#121417]/80 leading-relaxed font-medium pt-2.5 border-t border-[#121417]/10 animate-fade-in space-y-2">
                <p>{activeCourse.description || 'Track your learning, mark lectures as completed, take timestamped notes, and maintain your study streak.'}</p>
                {activeCourse.playlistId && (
                  <p className="font-mono text-[11px] text-slate-500">
                    Playlist ID: {activeCourse.playlistId}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dropped-down Right Sidebar: displayed on smaller/tablet viewports (unless explicitly collapsed, e.g. by the demo tour) */}
        <div className={`${isRightPanelOpen ? 'block lg:hidden' : 'hidden'} mt-4 xl:mt-6`}>
          <WorkspaceRightPanel embedded={true} />
        </div>

        {/* Workspace Ads Container - at bottom for all devices, comes up after scroll */}
        <div className="mt-4 xl:mt-6">
          <WorkspaceAdBanner />
        </div>
      </div>
    </main>
  );
};
