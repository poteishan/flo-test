import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Course, NoteFolder, PomodoroStats, VideoNote } from '../types';

/**
 * Supabase Data Service
 * Transparently manages cloud persistence for courses, folders, notes, and focus streaks
 * tied to Clerk user IDs.
 */

// 1. User Courses
export async function fetchUserCoursesFromCloud(userId: string): Promise<Course[] | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_courses')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetchUserCourses notice:', error.message);
      return null;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description || '',
      playlistId: row.playlist_id,
      videos: Array.isArray(row.videos) ? row.videos : [],
    }));
  } catch (err) {
    console.warn('Error fetching courses from Supabase:', err);
    return null;
  }
}

export async function upsertUserCourseToCloud(userId: string, course: Course): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_courses')
      .upsert({
        id: course.id,
        user_id: userId,
        title: course.title,
        description: course.description || '',
        playlist_id: course.playlistId || null,
        videos: course.videos,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Supabase upsertUserCourse error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error saving course to Supabase:', err);
    return false;
  }
}

export async function deleteUserCourseFromCloud(userId: string, courseId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_courses')
      .delete()
      .eq('id', courseId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Supabase deleteUserCourse error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting course from Supabase:', err);
    return false;
  }
}

// 2. User Notebook Folders
export async function fetchUserFoldersFromCloud(userId: string): Promise<NoteFolder[] | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase fetchUserFolders notice (using local storage):', error.message);
      return null;
    }

    if (!data) return [];
    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      createdAt: Number(row.created_at) || Date.now(),
    }));
  } catch (err) {
    console.warn('Error fetching folders from Supabase:', err);
    return null;
  }
}

export async function upsertUserFolderToCloud(userId: string, folder: NoteFolder): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_folders')
      .upsert({
        id: folder.id,
        user_id: userId,
        name: folder.name,
        created_at: folder.createdAt || Date.now(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Supabase upsertUserFolder error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error saving folder to Supabase:', err);
    return false;
  }
}

export async function deleteUserFolderFromCloud(userId: string, folderId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Supabase deleteUserFolder error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting folder from Supabase:', err);
    return false;
  }
}

// 3. User Notes
export async function fetchUserNotesFromCloud(userId: string): Promise<Record<string, VideoNote> | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      // Graceful notice without breaking
      console.warn('Supabase fetchUserNotes notice (using local storage):', error.message);
      return null;
    }

    const notesMap: Record<string, VideoNote> = {};
    if (data) {
      data.forEach((row: any) => {
        const folderId = row.folder_id || row.course_id || 'general';
        const courseId = row.course_id || folderId;
        const videoId = row.video_id || row.id || 'default';
        const key = `${folderId}_${videoId}`;
        notesMap[key] = {
          videoId,
          courseId,
          folderId,
          title: row.title || 'Untitled Note',
          content: row.content || '',
          color: row.color || '#ffffff',
          isPinned: Boolean(row.is_pinned),
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
        };
      });
    }
    return notesMap;
  } catch (err) {
    console.warn('Error fetching notes from Supabase:', err);
    return null;
  }
}

export async function upsertUserNoteToCloud(userId: string, note: VideoNote): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  const folderId = note.folderId || note.courseId || 'general';
  const courseId = note.courseId || folderId;
  const noteId = `${userId}_${courseId}_${note.videoId}`;

  try {
    // Attempt full payload first
    const fullPayload = {
      id: noteId,
      user_id: userId,
      course_id: courseId,
      folder_id: folderId,
      video_id: note.videoId,
      title: note.title || '',
      content: note.content || '',
      color: note.color || '#ffffff',
      is_pinned: Boolean(note.isPinned),
      updated_at: new Date(note.updatedAt || Date.now()).toISOString(),
    };

    const { error } = await supabase
      .from('user_notes')
      .upsert(fullPayload);

    if (!error) {
      return true;
    }

    console.warn('Supabase upsertUserNote warning (full payload):', error.message);

    // Resilient fallback: if database column like 'color' or 'folder_id' is missing before migration
    if (error.code === 'PGRST204') {
      const basicPayload: any = {
        id: noteId,
        user_id: userId,
        video_id: note.videoId,
        content: note.content || '',
        updated_at: new Date(note.updatedAt || Date.now()).toISOString(),
      };
      const { error: fallbackErr } = await supabase
        .from('user_notes')
        .upsert(basicPayload);

      if (fallbackErr) {
        console.warn('Supabase fallback upsert error:', fallbackErr.message);
        return false;
      }
      return true;
    }

    return false;
  } catch (err) {
    console.warn('Error saving note to Supabase:', err);
    return false;
  }
}

export async function deleteUserNoteFromCloud(userId: string, courseId: string, videoId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const noteId = `${userId}_${courseId}_${videoId}`;
    const { error } = await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      console.warn('Supabase deleteUserNote error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error deleting note from Supabase:', err);
    return false;
  }
}

// 3. User Study Streaks & Stats
export async function fetchUserStreakFromCloud(userId: string): Promise<PomodoroStats | null> {
  if (!isSupabaseConfigured || !supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      // PGRST116 means 0 rows found, which is normal for new users
      if (error.code !== 'PGRST116') {
        console.warn('Supabase fetchUserStreak notice:', error.message);
      }
      return null;
    }

    if (!data) return null;

    return {
      streakDays: data.streak_days || 0,
      sessionsCompleted: data.sessions_completed || 0,
      todayFocusMinutes: data.today_focus_minutes || 0,
      lastActiveDate: data.last_study_date || new Date().toISOString().split('T')[0],
    };
  } catch (err) {
    console.warn('Error fetching streak from Supabase:', err);
    return null;
  }
}

export async function upsertUserStreakToCloud(userId: string, stats: PomodoroStats): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !userId) return false;
  try {
    const { error } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: userId,
        streak_days: stats.streakDays,
        sessions_completed: stats.sessionsCompleted,
        today_focus_minutes: stats.todayFocusMinutes,
        last_study_date: stats.lastActiveDate,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.warn('Supabase upsertUserStreak error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error saving streak to Supabase:', err);
    return false;
  }
}
