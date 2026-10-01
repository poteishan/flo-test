export interface VideoItem {
  id: string;
  youtubeId: string;
  title: string;
  duration?: string;
  completed: boolean;
  thumbnail?: string;
  /** Timestamp (ms) when title/duration were last fetched from a YouTube source; drives 30-day refresh. */
  metadataFetchedAt?: number;
}

export interface Course {
  id: string;
  title: string;
  author?: string;
  description?: string;
  playlistId?: string;
  videos: VideoItem[];
}

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

export interface PomodoroSettings {
  workDuration: number; // in minutes
  shortBreakDuration: number;
  longBreakDuration: number;
  soundEnabled: boolean;
}

export interface PomodoroStats {
  sessionsCompleted: number;
  todayFocusMinutes: number;
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
}

export interface NoteFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface VideoNote {
  videoId: string; // unique note id
  courseId: string; // folder ID (e.g. 'general', 'folder_xxx')
  folderId?: string;
  title: string;
  content: string;
  color: string;
  isPinned: boolean;
  updatedAt: number;
}
