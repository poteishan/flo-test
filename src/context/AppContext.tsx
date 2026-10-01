import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Course, VideoItem, PomodoroMode, PomodoroSettings, PomodoroStats, VideoNote, NoteFolder } from '../types';
import { soundManager } from '../utils/audio';
import confetti from 'canvas-confetti';
import debounce from 'lodash.debounce';
import { isSupabaseConfigured } from '../lib/supabase';
import { 
  fetchUserCoursesFromCloud, 
  upsertUserCourseToCloud, 
  deleteUserCourseFromCloud,
  fetchUserFoldersFromCloud,
  upsertUserFolderToCloud,
  deleteUserFolderFromCloud,
  fetchUserNotesFromCloud,
  upsertUserNoteToCloud,
  deleteUserNoteFromCloud,
  fetchUserStreakFromCloud,
  upsertUserStreakToCloud
} from '../services/db';
import { resolvePlaylistTitles, isGenericLectureTitle, enrichVideosWithKnownData, needsMetadataRefresh } from '../utils/youtubeTitles';

export interface TimerCelebrationState {
  type: 'work' | 'break';
  durationMinutes: number;
}

type NoteSyncFn = ((uid: string, note: VideoNote) => void) & { cancel: () => void; flush: () => void };

// Cloud note rows are keyed by `${userId}_${courseId}_${videoId}`, where courseId falls back to
// the folder (see upsertUserNoteToCloud); these helpers mirror that so deletes hit the same row.
const cloudNoteCourseId = (note: VideoNote) => note.courseId || note.folderId || 'general';
const cloudNoteKey = (note: VideoNote) => `${cloudNoteCourseId(note)}_${note.videoId}`;

interface AppContextType {
  // Courses & Tracklist
  courses: Course[];
  activeCourse: Course | null;
  activeVideo: VideoItem | undefined;
  activeCourseId: string;
  activeVideoId: string;
  setActiveCourseId: (id: string) => void;
  setActiveVideoId: (id: string) => void;
  toggleVideoCompletion: (courseId: string, videoId: string) => void;
  setVideoCompleted: (courseId: string, videoId: string, completed: boolean) => void;
  markCourseCompleted: (courseId: string, completed: boolean) => void;
  addCourse: (course: Course) => void;
  updateCourseVideos: (courseId: string, videos: VideoItem[], title?: string) => void;
  updateVideoDuration: (courseId: string, videoId: string, duration: string) => void;
  deleteCourse: (courseId: string) => void;
  resetAllData: () => void;

  // Notes & User Folders
  folders: NoteFolder[];
  activeFolderId: string;
  setActiveFolderId: (id: string) => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  activeNoteKey: string;
  setActiveNoteKey: (key: string) => void;
  createNoteInFolder: (folderId?: string, title?: string) => string;
  notes: Record<string, VideoNote>;
  getNoteForCurrentVideo: () => VideoNote;
  saveNoteForCurrentVideo: (noteUpdate: Partial<VideoNote>) => void;
  saveNote: (key: string, noteUpdate: Partial<VideoNote>) => void;
  deleteNote: (key: string) => void;
  createNote: (courseId?: string, videoId?: string, title?: string) => string;
  createGeneralNote: (title?: string) => string;
  activeGeneralNoteKey: string;
  setActiveGeneralNoteKey: (key: string) => void;
  isNoteSaving: boolean;
  lastSavedTime: string | null;

  // Pomodoro
  pomodoroMode: PomodoroMode;
  pomodoroTimeLeft: number;
  isPomodoroRunning: boolean;
  pomodoroSettings: PomodoroSettings;
  pomodoroStats: PomodoroStats;
  recordDailyActivity: (extraMinutes?: number) => void;
  startPomodoro: () => void;
  pausePomodoro: () => void;
  resetPomodoro: () => void;
  skipPomodoro: () => void;
  setPomodoroMode: (mode: PomodoroMode) => void;
  updatePomodoroSettings: (settings: Partial<PomodoroSettings>) => void;
  isPomodoroExpanded: boolean;
  setIsPomodoroExpanded: (expanded: boolean) => void;

  // Timer Celebration Modal State & Actions
  timerCelebration: TimerCelebrationState | null;
  setTimerCelebration: (state: TimerCelebrationState | null) => void;
  startNextSprint: () => void;
  startBreakAfterWork: () => void;
  extendBreak: (extraMinutes?: number) => void;

  // YouTube Player Ref and Sync
  ytPlayer: any;
  setYtPlayer: (player: any) => void;
  seekTo: (seconds: number) => void;
  getCurrentPlayerTime: () => number;
  playerState: string;
  setPlayerState: (state: string) => void;

  // UI layout toggles
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isNotesOpen: boolean;
  setIsNotesOpen: (open: boolean) => void;
  workspaceRightTab: 'playlist' | 'notes';
  setWorkspaceRightTab: (tab: 'playlist' | 'notes') => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (open: boolean) => void;
  isFloatingTimerOpen: boolean;
  setIsFloatingTimerOpen: (open: boolean) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  hasClerkKey: boolean;

  // View Navigation: 'playlists' (hub), 'workspace' (player), or 'notes' (dedicated notes page)
  currentView: 'playlists' | 'workspace' | 'notes';
  setCurrentView: (view: 'playlists' | 'workspace' | 'notes') => void;

  // Playback Resume & Position Tracking (Indexed by courseId and videoId)
  savePlaybackPosition: (courseId: string, videoId: string, seconds: number) => void;
  getPlaybackPosition: (courseId: string, videoId: string) => number;
  clearPlaybackPosition: (courseId: string, videoId: string) => void;

  // Cloud Sync
  isCloudConnected: boolean;
  isCloudSyncing: boolean;
}

const STORAGE_KEYS = {
  COURSES: 'devtrack_courses_v2',
  ACTIVE_COURSE: 'devtrack_active_course_v2',
  ACTIVE_VIDEO: 'devtrack_active_video_v2',
  COMPLETED_VIDEOS: 'devtrack_completed_videos_v2',
  NOTES: 'devtrack_notes_v2',
  FOLDERS: 'devtrack_user_folders_v3',
  ACTIVE_FOLDER: 'devtrack_active_folder_v3',
  ACTIVE_NOTE: 'devtrack_active_note_v3',
  POMODORO_SETTINGS: 'devtrack_pomo_settings_v2',
  POMODORO_STATS: 'devtrack_pomo_stats_v2',
  PLAYBACK_POSITIONS: 'devtrack_playback_pos_v2',
};

const DEFAULT_POMO_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  soundEnabled: true,
};

const DEFAULT_POMO_STATS: PomodoroStats = {
  sessionsCompleted: 0,
  todayFocusMinutes: 0,
  streakDays: 0,
  lastActiveDate: new Date().toISOString().split('T')[0],
};

const AppContext = createContext<AppContextType | null>(null);

export interface AppProviderProps {
  children: React.ReactNode;
  hasClerkKey?: boolean;
  userId?: string | null;
}

export const AppProvider: React.FC<AppProviderProps> = ({ 
  children, 
  hasClerkKey = false,
  userId = null
}) => {
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [timerCelebration, setTimerCelebration] = useState<TimerCelebrationState | null>(null);

  // Dedicated persistent completed videos registry (courseId::videoId or courseId::youtubeId -> true)
  const [completedVideosRegistry, setCompletedVideosRegistry] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPLETED_VIDEOS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const completedVideosRef = useRef<Record<string, boolean>>(completedVideosRegistry);
  useEffect(() => {
    completedVideosRef.current = completedVideosRegistry;
  }, [completedVideosRegistry]);

  // View Navigation: 'playlists' (hub), 'workspace' (player & notes), or 'notes' (dedicated page)
  const [currentView, setCurrentView] = useState<'playlists' | 'workspace' | 'notes'>('playlists');

  // Playback positions per video ID
  const [playbackPositions, setPlaybackPositions] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PLAYBACK_POSITIONS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const playbackPositionsRef = useRef<Record<string, number>>(playbackPositions);
  useEffect(() => {
    playbackPositionsRef.current = playbackPositions;
  }, [playbackPositions]);

  const savePlaybackPosition = useCallback((courseId: string, videoId: string, seconds: number) => {
    if (!courseId || !videoId || seconds < 0) return;
    const key = `${courseId}::${videoId}`;
    const cur = playbackPositionsRef.current[key] || 0;
    // Don't save if position change is minimal (< 2s)
    if (Math.abs(cur - seconds) < 2) return;

    setPlaybackPositions(prev => {
      const updated = { ...prev, [key]: Math.floor(seconds) };
      playbackPositionsRef.current = updated;
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const getPlaybackPosition = useCallback((courseId: string, videoId: string): number => {
    if (!courseId || !videoId) return 0;
    const key = `${courseId}::${videoId}`;
    return playbackPositionsRef.current[key] || playbackPositionsRef.current[videoId] || 0;
  }, []);

  const clearPlaybackPosition = useCallback((courseId: string, videoId: string) => {
    if (!courseId || !videoId) return;
    const key = `${courseId}::${videoId}`;
    setPlaybackPositions(prev => {
      const updated = { ...prev };
      delete updated[key];
      delete updated[videoId];
      playbackPositionsRef.current = updated;
      try {
        localStorage.setItem(STORAGE_KEYS.PLAYBACK_POSITIONS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // 1. Courses State - Starts clean and empty with persistent completion hydration
  const [courses, setCourses] = useState<Course[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
      const savedRegStr = localStorage.getItem(STORAGE_KEYS.COMPLETED_VIDEOS);
      const reg: Record<string, boolean> = savedRegStr ? JSON.parse(savedRegStr) : {};

      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((course: Course) => {
            const videosWithCompletion = course.videos.map(v => {
              const isComp = v.completed || reg[`${course.id}::${v.id}`] || (v.youtubeId ? reg[`${course.id}::${v.youtubeId}`] : false) || false;
              return { ...v, completed: isComp };
            });

            const enrichedVideos = enrichVideosWithKnownData(videosWithCompletion, course.playlistId);
            return { ...course, videos: enrichedVideos };
          });
        }
      }
    } catch (e) {
      console.error('Failed to load courses from localStorage', e);
    }
    return []; // Completely empty by default
  });

  const [activeCourseId, setActiveCourseIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_COURSE);
    return saved && courses.some(c => c.id === saved) ? saved : (courses[0]?.id || '');
  });

  const activeCourse = courses.find(c => c.id === activeCourseId) || courses[0] || null;

  const [activeVideoId, setActiveVideoIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_VIDEO);
    if (saved && activeCourse?.videos.some(v => v.id === saved)) return saved;
    return activeCourse?.videos[0]?.id || '';
  });

  const activeVideo = activeCourse?.videos.find(v => v.id === activeVideoId) || activeCourse?.videos[0];

  // 2. User Folders & Notes State (User-created only)
  const [folders, setFolders] = useState<NoteFolder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      { id: 'general', name: 'General Notes', createdAt: Date.now() }
    ];
  });

  const [activeFolderId, setActiveFolderIdState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_FOLDER);
    return saved || 'general';
  });

  const [notes, setNotes] = useState<Record<string, VideoNote>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Failed to load notes from localStorage', e);
    }
    return {
      general_default: {
        videoId: 'default',
        courseId: 'general',
        folderId: 'general',
        title: 'Quick Note',
        content: '',
        color: '#ffffff',
        isPinned: false,
        updatedAt: Date.now(),
      }
    };
  });

  const [activeNoteKey, setActiveNoteKeyState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_NOTE);
    return saved || 'general_default';
  });

  const [activeGeneralNoteKey, setActiveGeneralNoteKey] = useState<string>(() => {
    return 'general_default';
  });

  // Sync folders & active pointers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
    } catch {}
  }, [folders]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_FOLDER, activeFolderId);
    } catch {}
  }, [activeFolderId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_NOTE, activeNoteKey);
    } catch {}
  }, [activeNoteKey]);

  const [isNoteSaving, setIsNoteSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // 3. Pomodoro State
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POMODORO_SETTINGS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_POMO_SETTINGS;
  });

  const getDaysDifference = (dateStr1: string, dateStr2: string): number => {
    try {
      const d1 = new Date(dateStr1 + 'T00:00:00');
      const d2 = new Date(dateStr2 + 'T00:00:00');
      const diffTime = d2.getTime() - d1.getTime();
      return Math.round(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const [pomodoroStats, setPomodoroStats] = useState<PomodoroStats>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.POMODORO_STATS);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        if (parsed.lastActiveDate) {
          const daysDiff = getDaysDifference(parsed.lastActiveDate, today);
          if (daysDiff === 0) {
            return parsed;
          } else if (daysDiff === 1) {
            // Yesterday was active. If user qualified yesterday (streak > 0 or 10+ mins), preserve streak.
            const qualifiedYesterday = (parsed.todayFocusMinutes >= 10) || (parsed.streakDays > 0);
            return {
              ...parsed,
              todayFocusMinutes: 0,
              streakDays: qualifiedYesterday ? parsed.streakDays : 0,
              lastActiveDate: today,
            };
          } else if (daysDiff > 1) {
            // Missed 1 or more full days -> streak resets to 0 until 10 minutes logged today
            return {
              ...parsed,
              todayFocusMinutes: 0,
              streakDays: 0,
              lastActiveDate: today,
            };
          }
        }
        return parsed;
      }
    } catch {}
    return DEFAULT_POMO_STATS;
  });

  const [pomodoroMode, setPomodoroMode] = useState<PomodoroMode>('work');
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState<number>(pomodoroSettings.workDuration * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState<boolean>(false);
  const [isPomodoroExpanded, setIsPomodoroExpanded] = useState<boolean>(false);

  // 4. YouTube Player API Reference
  const [ytPlayer, setYtPlayer] = useState<any>(null);
  const [playerState, setPlayerState] = useState<string>('unstarted');

  // 5. UI Layout toggles
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isNotesOpen, setIsNotesOpen] = useState<boolean>(true);
  const [workspaceRightTab, setWorkspaceRightTab] = useState<'playlist' | 'notes'>('playlist');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [isFloatingTimerOpen, setIsFloatingTimerOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  // --- Cloud Sync Effect (Supabase) ---
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let isSubscribed = true;

    const syncFromCloud = async () => {
      setIsCloudSyncing(true);
      try {
        // 1. Fetch courses from Supabase
        const cloudCourses = await fetchUserCoursesFromCloud(userId);
        if (isSubscribed && cloudCourses !== null) {
          if (cloudCourses.length > 0) {
            setCourses(cloudCourses);
            setActiveCourseIdState(cloudCourses[0].id);
            if (cloudCourses[0].videos[0]) {
              setActiveVideoIdState(cloudCourses[0].videos[0].id);
            }
          } else if (courses.length > 0) {
            // First-time sync: migrate user's local courses to cloud!
            for (const c of courses) {
              await upsertUserCourseToCloud(userId, c);
            }
          }
        }

        // 2. Fetch & Sync Folders from Supabase
        const cloudFolders = await fetchUserFoldersFromCloud(userId);
        if (isSubscribed && cloudFolders !== null) {
          const folderMap = new Map<string, NoteFolder>();
          cloudFolders.forEach(f => folderMap.set(f.id, f));

          // Ensure 'general' default folder always exists
          if (!folderMap.has('general')) {
            folderMap.set('general', { id: 'general', name: 'General Notes', createdAt: 0 });
          }

          // Migrate local custom folders to cloud if not yet present
          for (const localFolder of folders) {
            if (!folderMap.has(localFolder.id)) {
              folderMap.set(localFolder.id, localFolder);
              await upsertUserFolderToCloud(userId, localFolder);
            }
          }

          setFolders(Array.from(folderMap.values()));
        }

        // 3. Fetch & Sync Notes from Supabase (Bi-directional migration)
        const cloudNotes = await fetchUserNotesFromCloud(userId);
        if (isSubscribed && cloudNotes !== null) {
          const mergedNotes: Record<string, VideoNote> = { ...cloudNotes };
          const notesToUpload: VideoNote[] = [];

          // Compare with local notes
          Object.entries(notes).forEach(([key, localNote]) => {
            const cloudNote = cloudNotes[key];
            if (!cloudNote) {
              // Note exists locally but not in cloud -> keep & upload to cloud
              mergedNotes[key] = localNote;
              notesToUpload.push(localNote);
            } else if ((localNote.updatedAt || 0) > (cloudNote.updatedAt || 0)) {
              // Local is newer -> update cloud
              mergedNotes[key] = localNote;
              notesToUpload.push(localNote);
            }
          });

          setNotes(mergedNotes);

          // Upload any local notes that were missing or newer in cloud
          for (const noteToPush of notesToUpload) {
            await upsertUserNoteToCloud(userId, noteToPush);
          }
        }

        // 4. Fetch Pomodoro streak from Supabase
        const cloudStreak = await fetchUserStreakFromCloud(userId);
        if (isSubscribed && cloudStreak !== null) {
          setPomodoroStats(cloudStreak);
        }
      } catch (err) {
        console.warn('Cloud sync error:', err);
      } finally {
        if (isSubscribed) setIsCloudSyncing(false);
      }
    };

    syncFromCloud();

    return () => {
      isSubscribed = false;
    };
  }, [userId]);

  // Persist courses to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
    } catch (e) {
      console.error(e);
    }
  }, [courses]);

  // Auto-enrich any courses in state on startup with known catalog titles & durations
  useEffect(() => {
    let hasAnyChanges = false;
    const updatedCourses = courses.map(course => {
      const enriched = enrichVideosWithKnownData(course.videos, course.playlistId);
      const isDiff = enriched.some((v, i) => v.title !== course.videos[i]?.title || v.duration !== course.videos[i]?.duration);
      if (isDiff) {
        hasAnyChanges = true;
        return { ...course, videos: enriched };
      }
      return course;
    });

    if (hasAnyChanges) {
      setCourses(updatedCourses);
      try {
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(updatedCourses));
      } catch {}
    }
  }, []);

  // Dynamically resolve any generic lecture titles ("Lecture 06", etc.) and durations
  useEffect(() => {
    if (!activeCourse || !activeCourse.videos || activeCourse.videos.length === 0) return;
    const hasGeneric = activeCourse.videos.some(v => v.youtubeId && isGenericLectureTitle(v.title));
    const hasGenericDur = activeCourse.videos.some(v => !v.duration || v.duration === '20:00' || v.duration === '--:--');
    const hasStaleMetadata = activeCourse.videos.some(needsMetadataRefresh);
    if (!hasGeneric && !hasGenericDur && !hasStaleMetadata) return;

    let isMounted = true;

    resolvePlaylistTitles(activeCourse.videos, (updatedList) => {
      if (isMounted) {
        setCourses(prevCourses =>
          prevCourses.map(c => {
            if (c.id !== activeCourse.id) return c;
            const titleMap = new Map(updatedList.map(u => [u.id || u.youtubeId, u.title]));
            const ytTitleMap = new Map(updatedList.map(u => [u.youtubeId, u.title]));
            const durMap = new Map(updatedList.map(u => [u.id || u.youtubeId, u.duration]));
            const ytDurMap = new Map(updatedList.map(u => [u.youtubeId, u.duration]));
            const fetchedAtMap = new Map(updatedList.map(u => [u.id || u.youtubeId, u.metadataFetchedAt]));
            const ytFetchedAtMap = new Map(updatedList.map(u => [u.youtubeId, u.metadataFetchedAt]));

            const merged = c.videos.map(v => {
              const newTitle = titleMap.get(v.id) || ytTitleMap.get(v.youtubeId);
              const newDur = durMap.get(v.id) || ytDurMap.get(v.youtubeId);
              const newFetchedAt = fetchedAtMap.get(v.id) || ytFetchedAtMap.get(v.youtubeId);
              return {
                ...v,
                title: newTitle && !isGenericLectureTitle(newTitle) ? newTitle : v.title,
                duration: newDur && newDur !== '20:00' && newDur !== '--:--' ? newDur : v.duration,
                metadataFetchedAt: newFetchedAt || v.metadataFetchedAt,
              };
            });
            return { ...c, videos: merged };
          })
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeCourse?.id, activeCourse?.videos?.length]);

  // Save active course & video selection
  const setActiveCourseId = useCallback((id: string) => {
    setActiveCourseIdState(id);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_COURSE, id);
    const target = courses.find(c => c.id === id);
    if (target && target.videos.length > 0) {
      setActiveVideoIdState(target.videos[0].id);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_VIDEO, target.videos[0].id);
    }
  }, [courses]);

  const setActiveVideoId = useCallback((id: string) => {
    setActiveVideoIdState(id);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_VIDEO, id);
  }, []);

  // Save notes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch (e) {
      console.error(e);
    }
  }, [notes]);

  // Save Pomodoro Settings & Stats
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POMODORO_SETTINGS, JSON.stringify(pomodoroSettings));
    } catch {}
  }, [pomodoroSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.POMODORO_STATS, JSON.stringify(pomodoroStats));
    } catch {}
  }, [pomodoroStats]);

  // Record daily study activity and increment streak at >= 10 mins of watch/focus time
  const recordDailyActivity = useCallback((extraMinutes: number = 0) => {
    const today = new Date().toISOString().split('T')[0];

    setPomodoroStats(prev => {
      const lastDate = prev.lastActiveDate || today;
      const daysDiff = getDaysDifference(lastDate, today);

      let baseStreak = prev.streakDays;
      let currentMinutes = prev.todayFocusMinutes;

      // Handle rollover across midnight if tab remained open
      if (daysDiff === 1) {
        const qualifiedYesterday = currentMinutes >= 10 || baseStreak > 0;
        baseStreak = qualifiedYesterday ? baseStreak : 0;
        currentMinutes = 0;
      } else if (daysDiff > 1) {
        baseStreak = 0;
        currentMinutes = 0;
      }

      const updatedMinutes = currentMinutes + extraMinutes;
      const wasQualified = currentMinutes >= 10;
      const isNowQualified = updatedMinutes >= 10;

      let nextStreak = baseStreak;

      // User reached the 10-minute threshold of study time today!
      if (!wasQualified && isNowQualified) {
        nextStreak = baseStreak + 1;
        soundManager.playSuccess();
        confetti({
          particleCount: 160,
          spread: 80,
          origin: { y: 0.5 },
        });
      }

      const updated: PomodoroStats = {
        ...prev,
        streakDays: nextStreak,
        todayFocusMinutes: updatedMinutes,
        sessionsCompleted: extraMinutes >= 15 ? prev.sessionsCompleted + 1 : prev.sessionsCompleted,
        lastActiveDate: today,
      };

      try {
        localStorage.setItem(STORAGE_KEYS.POMODORO_STATS, JSON.stringify(updated));
      } catch {}

      if (userId) {
        upsertUserStreakToCloud(userId, updated);
      }
      return updated;
    });
  }, [userId]);

  // Unified active learning heartbeat (1s interval)
  // Accumulates active seconds when video is playing, pomodoro is running, or user is studying
  const lastActivityTimestampRef = useRef<number>(Date.now());
  const activeSecondsCounterRef = useRef<number>(0);

  useEffect(() => {
    const markInteraction = () => {
      lastActivityTimestampRef.current = Date.now();
    };

    window.addEventListener('keydown', markInteraction, { passive: true });
    window.addEventListener('pointerdown', markInteraction, { passive: true });
    window.addEventListener('scroll', markInteraction, { passive: true });

    const heartbeat = window.setInterval(() => {
      // 1. YouTube video actively playing
      let isVideoPlaying = false;
      try {
        if (ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
          isVideoPlaying = ytPlayer.getPlayerState() === 1;
        }
      } catch {}

      // 2. Pomodoro work sprint active
      const isPomoSprint = isPomodoroRunning && pomodoroMode === 'work';

      // 3. User actively engaged in learning workspace (typing notes, interacting within last 45s)
      const isActivelyStudying = (Date.now() - lastActivityTimestampRef.current) < 45000;

      // Log time when actively studying (watching video, focus timer, or taking notes in workspace)
      if (isVideoPlaying || isPomoSprint || (isActivelyStudying && currentView !== 'playlists')) {
        activeSecondsCounterRef.current += 1;

        if (activeSecondsCounterRef.current >= 60) {
          activeSecondsCounterRef.current = 0;
          recordDailyActivity(1);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('keydown', markInteraction);
      window.removeEventListener('pointerdown', markInteraction);
      window.removeEventListener('scroll', markInteraction);
      clearInterval(heartbeat);
    };
  }, [ytPlayer, isPomodoroRunning, pomodoroMode, currentView, recordDailyActivity]);

  // Toggle Video Completion
  const toggleVideoCompletion = useCallback((courseId: string, videoId: string) => {
    setCourses(prev => {
      let nextCompletedVal = false;
      const updated = prev.map(c => {
        if (c.id !== courseId) return c;
        const updatedVideos = c.videos.map(v => {
          if (v.id !== videoId && v.youtubeId !== videoId) return v;
          const nextCompleted = !v.completed;
          nextCompletedVal = nextCompleted;
          if (nextCompleted) {
            recordDailyActivity(0);
            const remaining = c.videos.filter(x => x.id !== v.id && x.youtubeId !== v.youtubeId && !x.completed);
            if (remaining.length === 0) {
              soundManager.playSuccess();
              confetti({
                particleCount: 120,
                spread: 70,
                origin: { y: 0.6 }
              });
            } else {
              soundManager.playCheck();
            }
          }
          return { ...v, completed: nextCompleted };
        });
        const updatedCourse = { ...c, videos: updatedVideos };
        if (userId) {
          upsertUserCourseToCloud(userId, updatedCourse);
        }
        return updatedCourse;
      });

      // Synchronously write to localStorage immediately!
      try {
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(updated));
      } catch {}

      // Update completed registry and persist immediately
      const targetCourse = prev.find(c => c.id === courseId);
      const targetVid = targetCourse?.videos.find(v => v.id === videoId || v.youtubeId === videoId);
      const vidKey1 = `${courseId}::${targetVid?.id || videoId}`;
      const vidKey2 = targetVid?.youtubeId ? `${courseId}::${targetVid.youtubeId}` : null;

      setCompletedVideosRegistry(reg => {
        const nextReg = { ...reg };
        if (nextCompletedVal) {
          nextReg[vidKey1] = true;
          if (vidKey2) nextReg[vidKey2] = true;
        } else {
          delete nextReg[vidKey1];
          if (vidKey2) delete nextReg[vidKey2];
        }
        completedVideosRef.current = nextReg;
        try {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_VIDEOS, JSON.stringify(nextReg));
        } catch {}
        return nextReg;
      });

      return updated;
    });
  }, [userId, recordDailyActivity]);

  // Set Video Completed (idempotent, triggers celebrations on first-time completion)
  const setVideoCompleted = useCallback((courseId: string, videoId: string, completed: boolean) => {
    setCourses(prev => {
      let isFirstTime = false;
      const updated = prev.map(c => {
        if (c.id !== courseId) return c;
        const currentVid = c.videos.find(v => v.id === videoId || v.youtubeId === videoId);
        if (currentVid && currentVid.completed !== completed) {
          if (completed) isFirstTime = true;
        } else {
          return c; // Already in target completed state
        }

        const updatedVideos = c.videos.map(v => {
          if (v.id !== videoId && v.youtubeId !== videoId) return v;
          return { ...v, completed };
        });

        const updatedCourse = { ...c, videos: updatedVideos };
        if (userId) {
          upsertUserCourseToCloud(userId, updatedCourse);
        }
        return updatedCourse;
      });

      // Synchronously write to localStorage immediately!
      try {
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(updated));
      } catch {}

      if (isFirstTime) {
        recordDailyActivity(0);
        soundManager.playCheck();
        const course = prev.find(c => c.id === courseId);
        const remaining = course ? course.videos.filter(x => x.id !== videoId && x.youtubeId !== videoId && !x.completed) : [];
        if (remaining.length === 0) {
          soundManager.playSuccess();
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }

      // Update completed registry and persist immediately
      const targetCourse = prev.find(c => c.id === courseId);
      const targetVid = targetCourse?.videos.find(v => v.id === videoId || v.youtubeId === videoId);
      const vidKey1 = `${courseId}::${targetVid?.id || videoId}`;
      const vidKey2 = targetVid?.youtubeId ? `${courseId}::${targetVid.youtubeId}` : null;

      setCompletedVideosRegistry(reg => {
        const nextReg = { ...reg };
        if (completed) {
          nextReg[vidKey1] = true;
          if (vidKey2) nextReg[vidKey2] = true;
        } else {
          delete nextReg[vidKey1];
          if (vidKey2) delete nextReg[vidKey2];
        }
        completedVideosRef.current = nextReg;
        try {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_VIDEOS, JSON.stringify(nextReg));
        } catch {}
        return nextReg;
      });

      return updated;
    });
  }, [userId, recordDailyActivity]);

  const markCourseCompleted = useCallback((courseId: string, completed: boolean) => {
    setCourses(prev => {
      const updated = prev.map(c => {
        if (c.id !== courseId) return c;
        const updatedVideos = c.videos.map(v => ({ ...v, completed }));
        const updatedCourse = { ...c, videos: updatedVideos };
        if (userId) {
          upsertUserCourseToCloud(userId, updatedCourse);
        }
        return updatedCourse;
      });

      try {
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(updated));
      } catch {}

      setCompletedVideosRegistry(reg => {
        const nextReg = { ...reg };
        const course = prev.find(c => c.id === courseId);
        course?.videos.forEach(v => {
          const k1 = `${courseId}::${v.id}`;
          const k2 = v.youtubeId ? `${courseId}::${v.youtubeId}` : null;
          if (completed) {
            nextReg[k1] = true;
            if (k2) nextReg[k2] = true;
          } else {
            delete nextReg[k1];
            if (k2) delete nextReg[k2];
          }
        });
        completedVideosRef.current = nextReg;
        try {
          localStorage.setItem(STORAGE_KEYS.COMPLETED_VIDEOS, JSON.stringify(nextReg));
        } catch {}
        return nextReg;
      });

      return updated;
    });

    if (completed) {
      soundManager.playSuccess();
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
    }
  }, [userId]);

  // Add custom course
  const addCourse = useCallback((newCourse: Course) => {
    setCourses(prev => [newCourse, ...prev]);
    setActiveCourseId(newCourse.id);
    if (newCourse.videos[0]) {
      setActiveVideoId(newCourse.videos[0].id);
    }
    if (userId) {
      upsertUserCourseToCloud(userId, newCourse);
    }
  }, [setActiveCourseId, setActiveVideoId, userId]);

  // Update course videos dynamically (e.g. when synced from YouTube playlist API)
  const updateCourseVideos = useCallback((courseId: string, updatedVideos: VideoItem[], updatedTitle?: string) => {
    setCourses(prev => {
      const target = prev.find(c => c.id === courseId);
      if (!target) return prev;

      // PRESERVE completion states, titles, and durations of existing videos!
      const existingMap = new Map<string, VideoItem>();
      target.videos.forEach(v => {
        existingMap.set(v.id, v);
        if (v.youtubeId) existingMap.set(v.youtubeId, v);
      });

      const registry = completedVideosRef.current;

      // 1. Instant 0ms enrichment against known catalogs & caches
      const preEnriched = enrichVideosWithKnownData(updatedVideos, target.playlistId);

      const mergedVideos = preEnriched.map(uv => {
        const existing = existingMap.get(uv.id) || (uv.youtubeId ? existingMap.get(uv.youtubeId) : undefined);
        const isCompleted = uv.completed || 
          existing?.completed || 
          registry[`${courseId}::${uv.id}`] ||
          (uv.youtubeId ? registry[`${courseId}::${uv.youtubeId}`] : false) ||
          false;

        // Never let generic titles overwrite existing real titles
        const title = isGenericLectureTitle(uv.title) && existing?.title && !isGenericLectureTitle(existing.title)
          ? existing.title
          : uv.title;

        // Never let generic durations overwrite existing real durations
        const duration = (!uv.duration || uv.duration === '20:00' || uv.duration === '--:--') && existing?.duration && existing.duration !== '20:00' && existing.duration !== '--:--'
          ? existing.duration
          : uv.duration;

        return {
          ...uv,
          title,
          duration,
          completed: isCompleted
        };
      });

      const updated = prev.map(c => {
        if (c.id !== courseId) return c;
        const upd = {
          ...c,
          title: updatedTitle || c.title,
          videos: mergedVideos,
        };
        if (userId) {
          upsertUserCourseToCloud(userId, upd);
        }
        return upd;
      });

      try {
        localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(updated));
      } catch {}

      return updated;
    });
  }, [userId]);

  // Update a single video's duration dynamically
  const updateVideoDuration = useCallback((courseId: string, videoId: string, duration: string) => {
    if (!courseId || !videoId || !duration) return;
    setCourses(prev => prev.map(c => {
      if (c.id !== courseId) return c;
      let hasChanged = false;
      const updatedVideos = c.videos.map(v => {
        if (v.id === videoId && v.duration !== duration) {
          hasChanged = true;
          return { ...v, duration };
        }
        return v;
      });
      if (!hasChanged) return c;
      const updated = { ...c, videos: updatedVideos };
      if (userId) {
        upsertUserCourseToCloud(userId, updated);
      }
      return updated;
    }));
  }, [userId]);

  // Delete course
  const deleteCourse = useCallback((courseId: string) => {
    setCourses(prev => {
      const remaining = prev.filter(c => c.id !== courseId);
      return remaining;
    });
    if (activeCourseId === courseId) {
      const remaining = courses.filter(c => c.id !== courseId);
      const next = remaining[0];
      if (next) {
        setActiveCourseId(next.id);
      } else {
        setActiveCourseIdState('');
        setActiveVideoIdState('');
      }
    }
    if (userId) {
      deleteUserCourseFromCloud(userId, courseId);
    }
  }, [activeCourseId, courses, setActiveCourseId, userId]);

  // Reset all to empty
  const resetAllData = useCallback(() => {
    if (window.confirm('Are you sure you want to clear your courses, progress, and timer stats?')) {
      localStorage.clear();
      setCourses([]);
      setActiveCourseIdState('');
      setActiveVideoIdState('');
      setNotes({});
      setPomodoroSettings(DEFAULT_POMO_SETTINGS);
      setPomodoroStats(DEFAULT_POMO_STATS);
      setPomodoroMode('work');
      setPomodoroTimeLeft(DEFAULT_POMO_SETTINGS.workDuration * 60);
      setIsPomodoroRunning(false);
    }
  }, []);

  // User Notes & Folder operations
  const setActiveFolderId = useCallback((id: string) => {
    setActiveFolderIdState(id);
    // Find note in this folder
    const notesInFolder = Object.entries(notes).filter(([_, n]) => (n.courseId === id || n.folderId === id));
    if (notesInFolder.length > 0) {
      setActiveNoteKeyState(notesInFolder[0][0]);
    }
  }, [notes]);

  const setActiveNoteKey = useCallback((key: string) => {
    setActiveNoteKeyState(key);
    const target = notes[key];
    if (target && (target.courseId || target.folderId)) {
      setActiveFolderIdState(target.courseId || target.folderId || 'general');
    }
  }, [notes]);

  const createFolder = useCallback((name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return 'general';
    const newId = `folder_${Date.now()}`;
    const newFolder: NoteFolder = {
      id: newId,
      name: trimmed,
      createdAt: Date.now()
    };
    setFolders(prev => [...prev, newFolder]);
    setActiveFolderIdState(newId);
    if (userId) {
      upsertUserFolderToCloud(userId, newFolder);
    }
    return newId;
  }, [userId]);

  const renameFolder = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setFolders(prev => {
      const updated = prev.map(f => f.id === id ? { ...f, name: trimmed } : f);
      const target = updated.find(f => f.id === id);
      if (target && userId) {
        upsertUserFolderToCloud(userId, target);
      }
      return updated;
    });
  }, [userId]);

  // One debounced cloud sync per note, so editing one note never cancels another note's
  // pending save. Keyed by the note's cloud identity (the same fields its row id is built from).
  const noteSyncsRef = useRef(new Map<string, NoteSyncFn>());

  const debouncedSyncToCloud = useCallback((uid: string, noteToSave: VideoNote) => {
    const syncKey = cloudNoteKey(noteToSave);
    let sync = noteSyncsRef.current.get(syncKey);
    if (!sync) {
      sync = debounce((syncUid: string, latestNote: VideoNote) => {
        noteSyncsRef.current.delete(syncKey);
        upsertUserNoteToCloud(syncUid, latestNote).then(() => {
          if (noteSyncsRef.current.size === 0) setIsNoteSaving(false);
          setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        });
      }, 800);
      noteSyncsRef.current.set(syncKey, sync);
    }
    sync(uid, noteToSave);
  }, []);

  // Drop a note's pending save, so it can't re-create the note in the cloud after deletion.
  const cancelNoteSync = useCallback((note: VideoNote) => {
    const syncKey = cloudNoteKey(note);
    noteSyncsRef.current.get(syncKey)?.cancel();
    noteSyncsRef.current.delete(syncKey);
  }, []);

  // Send any saves still waiting in their 800ms window when the tab is closed or the provider unmounts.
  useEffect(() => {
    const flushAll = () => noteSyncsRef.current.forEach(sync => sync.flush());
    window.addEventListener('pagehide', flushAll);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      flushAll();
    };
  }, []);

  const deleteFolder = useCallback((id: string) => {
    if (id === 'general') {
      alert('General Notes folder cannot be deleted.');
      return;
    }
    setFolders(prev => prev.filter(f => f.id !== id));
    if (userId) {
      deleteUserFolderFromCloud(userId, id);
    }

    const removedNotes = Object.entries(notes).filter(([, n]) => n.courseId === id || n.folderId === id);
    setNotes(prev => {
      const next = { ...prev };
      removedNotes.forEach(([key]) => delete next[key]);
      return next;
    });
    removedNotes.forEach(([, note]) => {
      cancelNoteSync(note);
      if (userId) {
        deleteUserNoteFromCloud(userId, cloudNoteCourseId(note), note.videoId);
      }
    });

    setActiveFolderIdState('general');
    setActiveNoteKeyState('general_default');
  }, [userId, notes, cancelNoteSync]);

  const createNoteInFolder = useCallback((folderId: string = 'general', title?: string): string => {
    const vid = `note_${Date.now()}`;
    const key = `${folderId}_${vid}`;
    const newNote: VideoNote = {
      videoId: vid,
      courseId: folderId,
      folderId: folderId,
      title: title || 'Untitled Note',
      content: '',
      color: '#ffffff',
      isPinned: false,
      updatedAt: Date.now()
    };
    setNotes(prev => ({
      ...prev,
      [key]: newNote
    }));
    setActiveFolderIdState(folderId);
    setActiveNoteKeyState(key);
    if (userId) {
      debouncedSyncToCloud(userId, newNote);
    }
    return key;
  }, [userId, debouncedSyncToCloud]);

  const getNoteForCurrentVideo = useCallback((): VideoNote => {
    return notes[activeNoteKey] ?? {
      videoId: 'default',
      courseId: activeFolderId || 'general',
      folderId: activeFolderId || 'general',
      title: 'Quick Note',
      content: '',
      color: '#ffffff',
      isPinned: false,
      updatedAt: Date.now()
    };
  }, [notes, activeNoteKey, activeFolderId]);

  const saveNote = useCallback((key: string, noteUpdate: Partial<VideoNote>) => {
    setIsNoteSaving(true);
    setNotes(prev => {
      const existing = prev[key] ?? {
        videoId: '',
        courseId: '',
        title: 'Untitled Note',
        content: '',
        color: '#ffffff',
        isPinned: false,
        updatedAt: Date.now()
      };

      const updatedNote: VideoNote = {
        ...existing,
        ...noteUpdate,
        updatedAt: Date.now()
      };

      if (userId) {
        debouncedSyncToCloud(userId, updatedNote);
      } else {
        setTimeout(() => {
          setIsNoteSaving(false);
          setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 800);
      }

      return {
        ...prev,
        [key]: updatedNote,
      };
    });
  }, [userId, debouncedSyncToCloud]);

  const saveNoteForCurrentVideo = useCallback((noteUpdate: Partial<VideoNote>) => {
    saveNote(activeNoteKey, noteUpdate);
  }, [activeNoteKey, saveNote]);

  const deleteNote = useCallback((key: string) => {
    const target = notes[key];
    if (target) {
      cancelNoteSync(target);
      if (userId) {
        deleteUserNoteFromCloud(userId, cloudNoteCourseId(target), target.videoId);
      }
    }
    setNotes(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [userId, notes, cancelNoteSync]);

  const createNote = useCallback((courseId: string = 'general', videoId?: string, title?: string): string => {
    const vid = videoId || `custom_${Date.now()}`;
    const key = `${courseId}_${vid}`;
    const newNote: VideoNote = {
      courseId,
      videoId: vid,
      title: title || 'Untitled Note',
      content: '',
      color: '#ffffff',
      isPinned: false,
      updatedAt: Date.now()
    };
    setNotes(prev => ({
      ...prev,
      [key]: newNote
    }));
    if (userId) {
      debouncedSyncToCloud(userId, newNote);
    }
    return key;
  }, [userId, debouncedSyncToCloud]);

  const createGeneralNote = useCallback((title?: string): string => {
    const vid = `note_${Date.now()}`;
    const key = `general_${vid}`;
    const newNote: VideoNote = {
      courseId: 'general',
      videoId: vid,
      title: title || 'Quick Note',
      content: '',
      color: '#ffffff',
      isPinned: false,
      updatedAt: Date.now()
    };
    setNotes(prev => ({
      ...prev,
      [key]: newNote
    }));
    setActiveGeneralNoteKey(key);
    if (userId) {
      debouncedSyncToCloud(userId, newNote);
    }
    return key;
  }, [userId, debouncedSyncToCloud]);

  // Pomodoro Actions
  const timerIntervalRef = useRef<number | null>(null);

  const startPomodoro = useCallback(() => {
    setIsPomodoroRunning(true);
    if (pomodoroSettings.soundEnabled) {
      soundManager.playStart();
    }
  }, [pomodoroSettings.soundEnabled]);

  const pausePomodoro = useCallback(() => {
    setIsPomodoroRunning(false);
  }, []);

  const resetPomodoro = useCallback(() => {
    setIsPomodoroRunning(false);
    const duration = pomodoroMode === 'work' 
      ? pomodoroSettings.workDuration 
      : pomodoroMode === 'shortBreak' 
      ? pomodoroSettings.shortBreakDuration 
      : pomodoroSettings.longBreakDuration;
    setPomodoroTimeLeft(duration * 60);
  }, [pomodoroMode, pomodoroSettings]);

  const handleSetPomodoroMode = useCallback((mode: PomodoroMode) => {
    setPomodoroMode(mode);
    setIsPomodoroRunning(false);
    const duration = mode === 'work' 
      ? pomodoroSettings.workDuration 
      : mode === 'shortBreak' 
      ? pomodoroSettings.shortBreakDuration 
      : pomodoroSettings.longBreakDuration;
    setPomodoroTimeLeft(duration * 60);
  }, [pomodoroSettings]);

  const updatePomodoroSettings = useCallback((newSettings: Partial<PomodoroSettings>) => {
    setPomodoroSettings(prev => {
      const updated = { ...prev, ...newSettings };
      return updated;
    });
  }, []);

  const handleTimerComplete = useCallback(() => {
    setIsPomodoroRunning(false);
    if (pomodoroSettings.soundEnabled) {
      soundManager.playAlarm();
    }

    if (pomodoroMode === 'work') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });

      setPomodoroStats(prev => {
        const updated = {
          ...prev,
          sessionsCompleted: prev.sessionsCompleted + 1,
        };
        try {
          localStorage.setItem(STORAGE_KEYS.POMODORO_STATS, JSON.stringify(updated));
        } catch {}
        if (userId) {
          upsertUserStreakToCloud(userId, updated);
        }
        return updated;
      });

      // Trigger Celebration Modal for deep work completion
      setTimerCelebration({
        type: 'work',
        durationMinutes: pomodoroSettings.workDuration,
      });
    } else {
      // Break ended -> Trigger Break Celebration Modal
      setTimerCelebration({
        type: 'break',
        durationMinutes: pomodoroMode === 'shortBreak' ? pomodoroSettings.shortBreakDuration : pomodoroSettings.longBreakDuration,
      });
    }
  }, [pomodoroMode, pomodoroSettings, recordDailyActivity]);

  const startBreakAfterWork = useCallback(() => {
    setTimerCelebration(null);
    const isLong = (pomodoroStats.sessionsCompleted) % 4 === 0 && pomodoroStats.sessionsCompleted > 0;
    const breakMode = isLong ? 'longBreak' : 'shortBreak';
    handleSetPomodoroMode(breakMode);
    setIsPomodoroRunning(true);
  }, [pomodoroStats.sessionsCompleted, handleSetPomodoroMode]);

  const startNextSprint = useCallback(() => {
    setTimerCelebration(null);
    handleSetPomodoroMode('work');
    setIsPomodoroRunning(true);
  }, [handleSetPomodoroMode]);

  const extendBreak = useCallback((extraMinutes: number = 5) => {
    setTimerCelebration(null);
    setPomodoroTimeLeft(extraMinutes * 60);
    setIsPomodoroRunning(true);
  }, []);

  const skipPomodoro = useCallback(() => {
    handleTimerComplete();
  }, [handleTimerComplete]);

  // Pomodoro countdown timer tick
  useEffect(() => {
    if (isPomodoroRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setPomodoroTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isPomodoroRunning, handleTimerComplete]);

  // YouTube Controller helper
  const seekTo = useCallback((seconds: number) => {
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(seconds, true);
    }
  }, [ytPlayer]);

  const getCurrentPlayerTime = useCallback((): number => {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      return Math.floor(ytPlayer.getCurrentTime());
    }
    return 0;
  }, [ytPlayer]);

  return (
    <AppContext.Provider
      value={{
        courses,
        activeCourse,
        activeVideo,
        activeCourseId,
        activeVideoId,
        setActiveCourseId,
        setActiveVideoId,
        toggleVideoCompletion,
        setVideoCompleted,
        markCourseCompleted,
        addCourse,
        updateCourseVideos,
        updateVideoDuration,
        deleteCourse,
        resetAllData,
        folders,
        activeFolderId,
        setActiveFolderId,
        createFolder,
        renameFolder,
        deleteFolder,
        activeNoteKey,
        setActiveNoteKey,
        createNoteInFolder,
        notes,
        getNoteForCurrentVideo,
        saveNoteForCurrentVideo,
        saveNote,
        deleteNote,
        createNote,
        createGeneralNote,
        activeGeneralNoteKey,
        setActiveGeneralNoteKey,
        isNoteSaving,
        lastSavedTime,
        pomodoroMode,
        pomodoroTimeLeft,
        isPomodoroRunning,
        pomodoroSettings,
        pomodoroStats,
        recordDailyActivity,
        startPomodoro,
        pausePomodoro,
        resetPomodoro,
        skipPomodoro,
        setPomodoroMode: handleSetPomodoroMode,
        updatePomodoroSettings,
        isPomodoroExpanded,
        setIsPomodoroExpanded,
        timerCelebration,
        setTimerCelebration,
        startNextSprint,
        startBreakAfterWork,
        extendBreak,
        ytPlayer,
        setYtPlayer,
        seekTo,
        getCurrentPlayerTime,
        playerState,
        setPlayerState,
        isSidebarOpen,
        setIsSidebarOpen,
        isNotesOpen,
        setIsNotesOpen,
        workspaceRightTab,
        setWorkspaceRightTab,
        isRightPanelOpen,
        setIsRightPanelOpen,
        isFloatingTimerOpen,
        setIsFloatingTimerOpen,
        isAddModalOpen,
        setIsAddModalOpen,
        hasClerkKey,
        currentView,
        setCurrentView,
        savePlaybackPosition,
        getPlaybackPosition,
        clearPlaybackPosition,
        isCloudConnected: isSupabaseConfigured,
        isCloudSyncing,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
