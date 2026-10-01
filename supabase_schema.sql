-- ============================================================================
-- DEVTRACK: Supabase Database Schema & Row-Level Security (RLS) Setup
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- This creates/updates all required tables and enables RLS to secure user data.

-- 1. Table: user_courses
-- Stores saved YouTube courses and playlists per Clerk user ID
CREATE TABLE IF NOT EXISTS public.user_courses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    playlist_id TEXT,
    videos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_courses_user_id ON public.user_courses(user_id);

-- 2. Table: user_folders
-- Stores user-created notebook folders (e.g., "Java", "DSA") per user
CREATE TABLE IF NOT EXISTS public.user_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_folders_user_id ON public.user_folders(user_id);

-- 3. Table: user_notes
-- Stores rich-text markdown notes per user, course, folder, and video lecture
CREATE TABLE IF NOT EXISTS public.user_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT DEFAULT 'general',
    folder_id TEXT DEFAULT 'general',
    video_id TEXT NOT NULL,
    title TEXT DEFAULT '',
    content TEXT DEFAULT '',
    color TEXT DEFAULT '#ffffff',
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe migrations in case user_notes was created with older schema:
ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS course_id TEXT DEFAULT 'general';
ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS folder_id TEXT DEFAULT 'general';
ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '';
ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#ffffff';
ALTER TABLE public.user_notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_lookup ON public.user_notes(user_id, course_id, video_id);

-- 4. Table: user_streaks
-- Tracks focus streaks, study sessions completed, and daily minutes
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id TEXT PRIMARY KEY,
    sessions_completed INT DEFAULT 0,
    today_focus_minutes INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    last_study_date TEXT,
    last_active_date TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.user_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

-- These policies require Clerk to be added as a Third-Party Auth provider in the
-- Supabase dashboard first (Authentication -> Sign In / Providers -> Third Party
-- Auth -> Add Clerk, using your Clerk instance's Frontend API URL). Once that's
-- configured, auth.jwt()->>'sub' resolves to the authenticated Clerk user's ID.

DROP POLICY IF EXISTS "Users can manage own courses" ON public.user_courses;
CREATE POLICY "Users can manage own courses" ON public.user_courses
    FOR ALL
    USING (auth.jwt()->>'sub' = user_id)
    WITH CHECK (auth.jwt()->>'sub' = user_id);

DROP POLICY IF EXISTS "Users can manage own folders" ON public.user_folders;
CREATE POLICY "Users can manage own folders" ON public.user_folders
    FOR ALL
    USING (auth.jwt()->>'sub' = user_id)
    WITH CHECK (auth.jwt()->>'sub' = user_id);

DROP POLICY IF EXISTS "Users can manage own notes" ON public.user_notes;
CREATE POLICY "Users can manage own notes" ON public.user_notes
    FOR ALL
    USING (auth.jwt()->>'sub' = user_id)
    WITH CHECK (auth.jwt()->>'sub' = user_id);

DROP POLICY IF EXISTS "Users can manage own streaks" ON public.user_streaks;
CREATE POLICY "Users can manage own streaks" ON public.user_streaks
    FOR ALL
    USING (auth.jwt()->>'sub' = user_id)
    WITH CHECK (auth.jwt()->>'sub' = user_id);
