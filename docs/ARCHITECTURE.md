# FLO — Technical Architecture & Workflow Documentation

FLO (`flo.protrack.club`, repo currently hosted at `github.com/madhurcodess/flo`, formerly `dev-track`) is a distraction-free learning workspace built around YouTube playlists. A learner pastes a YouTube playlist or video link, and FLO turns it into a private "course": an embedded, recommendation-free player, a lecture checklist, timestamped notes, a Pomodoro focus timer, and a daily study streak — all wrapped in a single-page app with optional cloud sync.

This document describes how the codebase is put together: the stack, the data model, the state layer, the YouTube integration, and the major feature subsystems. It reflects the code as of the `feature/mobile-responsive` branch.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | React 19 + TypeScript | Function components, hooks only, no class components except one error boundary |
| Build tool | Vite 8 (`@vitejs/plugin-react`) | `tsc -b && vite build` for production builds |
| Styling | Tailwind CSS 3 + hand-rolled design tokens | Custom "signature" palette (`#EBF755` lime, `#121417` ink, `#F9F8F5` cream) and a `shadow-solid` neo-brutalist border/shadow style used everywhere |
| Linting | oxlint | Fast Rust-based linter (see root `README.md`) |
| Auth | Clerk (`@clerk/clerk-react`) | Hosted auth (Google/GitHub OAuth + email), modal sign-in/up, `SignedIn`/`SignedOut` gating |
| Cloud data | Supabase (`@supabase/supabase-js`) | Postgres-backed sync for courses, notes, folders, and streaks, keyed by Clerk `user_id` |
| Rich text notes | Tiptap 3 (`@tiptap/react`, `starter-kit`, `task-list`, `task-item`) | Custom `TimestampNode` extension for clickable `▶ [mm:ss]` pills |
| Video playback | YouTube IFrame Player API (official, `youtube.com/iframe_api`) | No third-party player wrapper |
| Icons | `lucide-react` | |
| Confetti / audio | `canvas-confetti`, native Web Audio API (`src/utils/audio.ts`) | Sounds are synthesized oscillators, not audio files |
| Hosting | Vercel | `vercel.json` sets security headers and an SPA rewrite (`/(.*) -> /index.html`) |

There is no backend server of its own — the only "server" pieces are Supabase (managed Postgres + REST API) and Clerk (managed auth). The app is a static SPA.

---

## 2. High-Level Architecture

```
                        ┌───────────────────────────────────────┐
                        │              main.tsx                 │
                        │  ClerkProvider (or fallback no-auth)   │
                        └───────────────────┬─────────────────────┘
                                            │
                        ┌───────────────────▼─────────────────────┐
                        │                 App.tsx                  │
                        │  SignedOut -> LandingPage | Demo Dashboard│
                        │  SignedIn  -> Dashboard (AppProvider)     │
                        └───────────────────┬─────────────────────┘
                                            │
                        ┌───────────────────▼─────────────────────┐
                        │         AppContext (context/)            │
                        │  single source of truth for:              │
                        │   • courses & videos                      │
                        │   • notes & folders                       │
                        │   • pomodoro timer & stats/streak          │
                        │   • YouTube player ref & playback state    │
                        │   • UI layout toggles + currentView        │
                        └───────┬───────────────────────┬───────────┘
                                │                        │
                   ┌────────────▼───────────┐  ┌──────────▼───────────┐
                   │  localStorage (guest)   │  │  Supabase (signed-in) │
                   │  devtrack_* keys         │  │  user_courses/folders │
                   │                          │  │  /notes/streaks tables│
                   └──────────────────────────┘  └───────────────────────┘

                        ┌───────────────────────────────────────┐
                        │        Dashboard (App.tsx)             │
                        │  Header · PlaylistsView | NotesView |  │
                        │  PlayerWorkspace + WorkspaceRightPanel │
                        │  FloatingTimerWidget · AddCourseModal  │
                        └───────────────────────────────────────┘
```

There is **no router** (no React Router). Navigation between the three main screens — Playlists hub, Notes hub, and the Learning Workspace — is a single piece of state, `currentView`, held in `AppContext` and flipped by the Header's segmented control.

---

## 3. Application Bootstrap & Auth ([main.tsx](../src/main.tsx), [App.tsx](../src/App.tsx))

- `main.tsx` resolves a Clerk publishable key with a fallback chain: `VITE_CLERK_PUBLISHABLE_KEY` env var → a value the user pasted into `localStorage` (`devtrack_custom_clerk_key`) → a hardcoded `pk_test_*` fallback key, so the app never white-screens even with no environment configured. It also force-switches a `pk_live_*` key to a dev key when running on `localhost`, so local dev never touches the production Clerk instance.
- `ClerkErrorBoundary` (a class component) catches any Clerk initialization failure and falls back to `hasClerkKey={false}`, which drops the whole app into a **guest/demo mode** with no authentication at all.
- `App.tsx` branches on `hasClerkKey`:
  - **No Clerk key** → always render `AppProvider(userId=null)` + either `LandingPage` or the demo `Dashboard` (`guestView` state toggles between them). Everything is local-only.
  - **Clerk key present** → `SignedOut` renders the same landing/demo flow (so visitors can try FLO before creating an account); `SignedIn` renders `SignedInWorkspace`, which pulls the real Clerk `user.id` and mounts `AppProvider(userId)`, enabling Supabase cloud sync.
- Auth itself is 100% delegated to Clerk (`SignInButton`/`SignUpButton` modals, `UserButton` for the signed-in avatar/menu). FLO does not implement its own password or session handling.

---

## 4. State Management — `AppContext` ([context/AppContext.tsx](../src/context/AppContext.tsx))

`AppContext` is one large provider (~1500 lines) that owns essentially all application state via `useState`/`useRef` + a big set of `useCallback` action creators, exposed through a single `useApp()` hook. There's no Redux/Zustand — this is intentionally a single context.

State domains it manages:

1. **Courses & videos** — `courses: Course[]`, `activeCourseId`, `activeVideoId`, plus mutators (`addCourse`, `updateCourseVideos`, `toggleVideoCompletion`, `deleteCourse`, `markCourseCompleted`, `resetAllData`). A separate `completedVideosRegistry` map (`courseId::videoId -> true`) persists completion state independently of the video list, so re-syncing a playlist's titles never loses progress.
2. **Notes & folders** — `notes: Record<key, VideoNote>`, `folders: NoteFolder[]`, with folder-scoped CRUD and a debounced (800 ms, `lodash.debounce`) cloud sync per note edit.
3. **Pomodoro** — mode (`work`/`shortBreak`/`longBreak`), countdown, running flag, settings (durations, sound on/off), and `pomodoroStats` (streak days, sessions completed, today's focused minutes) with day-rollover logic (`getDaysDifference`) that resets/preserves the streak based on whether yesterday's 10-minute threshold was met.
4. **YouTube player ref & playback** — a raw reference to the `YT.Player` instance (`ytPlayer`), `playerState`, and helpers (`seekTo`, `getCurrentPlayerTime`) used by the notes editor's timestamp feature.
5. **UI layout** — `currentView` (playlists/workspace/notes), sidebar/right-panel open flags, theater mode, active tab in the workspace right panel, add-course modal visibility.
6. **Playback position memory** — per `courseId::videoId`, saved to `localStorage` every ~2s while playing and restored (with a "Resumed playback from mm:ss / Start Over" banner) the next time that video loads, unless it's already marked completed.
7. **A unified "active study" heartbeat** — a 1-second interval that counts a minute of "active learning" whenever the YouTube player is actually playing (`getPlayerState() === 1`), or a Pomodoro work sprint is running, or the user has interacted with the page (keydown/pointerdown/scroll) within the last 45 seconds while outside the Playlists hub. Every 60 accumulated seconds calls `recordDailyActivity(1)`, which is what actually advances `todayFocusMinutes` and, once ≥10 minutes/day, increments the streak.

### Persistence strategy

- **Guest mode** (`userId === null`): everything lives in `localStorage` under keys prefixed `devtrack_*` (see `STORAGE_KEYS` in `AppContext.tsx`), namespaced by version suffix (`_v2`, `_v3`) so schema changes don't collide with older stored data.
- **Signed-in mode**: on mount, a `syncFromCloud()` effect fetches courses/folders/notes/streak from Supabase via `src/services/db.ts`. If the cloud has courses, they replace local state; if the cloud is empty but local state has courses, those are pushed up (one-time local→cloud migration on first sign-in). Every subsequent mutation (`toggleVideoCompletion`, `saveNote`, `upsertUserStreakToCloud`, etc.) writes to `localStorage` **and**, if signed in, to Supabase — localStorage is always kept warm as an offline-first cache/fallback even for signed-in users.

---

## 5. Data Layer — Supabase ([lib/supabase.ts](../src/lib/supabase.ts), [services/db.ts](../src/services/db.ts))

- `lib/supabase.ts` creates the Supabase client from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, falling back to a baked-in project URL + anon key if the env vars are absent (same "never white-screen" philosophy as the Clerk key).
- `services/db.ts` is a thin repository layer with four resource groups, each keyed by the Clerk `user_id`:
  - `user_courses` — `id, user_id, title, description, playlist_id, videos (jsonb), updated_at`. The entire `videos` array (titles, durations, `youtubeId`s, completion flags, and now `metadataFetchedAt`) is stored as one JSON blob per course, not as a normalized child table.
  - `user_folders` — note folders (`id, user_id, name, created_at`).
  - `user_notes` — one row per note (`id = <userId>_<courseId>_<videoId>`), with a schema-mismatch fallback: if `color`/`folder_id` columns are missing (pre-migration), it retries with a reduced payload (`PGRST204` handling).
  - `user_streaks` — one row per user holding the Pomodoro/streak counters.
- All Supabase calls are best-effort: failures are caught and logged via `console.warn`, never thrown, so a Supabase outage degrades to local-only mode rather than crashing the app.

---

## 6. YouTube Integration

This is the core subsystem and the one most relevant to platform policy compliance (see §10).

### 6.1 Parsing input ([utils/youtube.ts](../src/utils/youtube.ts))

`parseYouTubeInput()` accepts a raw playlist ID, a raw 11-char video ID, or any of: `youtube.com/playlist?list=...`, `youtube.com/watch?v=...`, `youtu.be/<id>`, `youtube.com/embed/<id>` — returning `{ type: 'playlist' | 'video' | 'invalid', playlistId?, videoId? }`.

### 6.2 Adding a course ([components/AddCourseModal.tsx](../src/components/AddCourseModal.tsx))

- Two hardcoded, fully pre-populated "known" playlists (a 57-video Java course and a 9-part Python course, in `src/data/javaCourseData.ts` / `pythonCourseData.ts`) are recognized by playlist ID and inserted instantly with real titles/durations already filled in.
- Any other playlist is created immediately with a single placeholder video (`"01. Loading course playlist..."`) — the real list is populated the moment the player is opened (see 6.3), so there's no waiting screen.
- A single video URL creates a one-video course directly.
- A "Batch Multi-Video" tab lets a user hand-build a course from a newline-separated list of `Title | URL` pairs.

### 6.3 Playback & playlist sync ([components/PlayerWorkspace.tsx](../src/components/PlayerWorkspace.tsx))

- The player is the **official YouTube IFrame Player API** (`<script src="https://www.youtube.com/iframe_api">` + `new window.YT.Player(...)`), configured with:
  - `modestbranding: 1`, `rel: 0` (no other-channel related videos at end), `playsinline: 1`, `fs: 0`, `enablejsapi: 1`, `origin: window.location.origin`.
  - Either a single `videoId`, or `listType: 'playlist', list: <playlistId>` when the course still has placeholder/dummy data.
- Once the player fires `onReady`, `syncPlaylistIfAvailable()` calls the player's own `getPlaylist()` / `getVideoData()` methods (both part of the official API) to read the *real* ordered list of video IDs and the first video's real title, and merges that into the stored course — this is what replaces the placeholder video with the actual playlist contents. No external network call is needed for this step.
- Video **titles/durations** for the remaining videos are then resolved via `resolvePlaylistTitles()` (see 6.4).
- Playback position (resume), completion-on-end, duration capture, and the "Resumed playback… Start Over" banner are all driven off the player's `onStateChange` events (`1` = playing, `2` = paused, `0` = ended) and `getCurrentTime()/getDuration()`.
- A 1-second interval also polls `getCurrentTime()`/`getDuration()` to keep the on-screen clock and duration in sync and to save playback position every ~2 seconds.

### 6.4 Title/duration resolution pipeline ([utils/youtubeTitles.ts](../src/utils/youtubeTitles.ts))

For any video whose title still looks generic (e.g. "Lecture 06") or whose duration is a placeholder:

1. **Known catalogs** (`enrichVideosWithKnownData`) — instant, synchronous, zero-network lookup against the two hardcoded course datasets and an in-memory cache of anything already resolved this session.
2. **YouTube's official oEmbed endpoint** (`https://www.youtube.com/oembed?url=...&format=json`) — public, documented, no API key required. Used as the primary network source for a real title.
3. **noembed.com** — an unofficial third-party mirror of oEmbed, tried *first* purely for speed/reliability (3.5s timeout, avoids YouTube rate limits), falling back to the official oEmbed endpoint if it fails.
4. Requests are batched in parallel groups of 8 to resolve a whole playlist quickly without stalling the browser's connection pool.
5. Each resolved video is stamped with `metadataFetchedAt: Date.now()`.

**30-day metadata refresh:** `needsMetadataRefresh(video)` returns true when a video has no `metadataFetchedAt` or it's older than 30 days. Both the resolution effect in `AppContext` and `resolvePlaylistTitles` itself treat such videos exactly like unresolved ones and re-fetch them, so cached titles/durations don't live forever without being refreshed against YouTube.

> **Removed in this branch:** an earlier version of this pipeline also called YouTube's private, undocumented `youtubei/v1/browse` ("InnerTube") endpoint — the same internal API youtube.com's own frontend uses — via a dev-only Vite proxy that spoofed `Origin`/`Referer` headers to impersonate youtube.com. That path has been deleted entirely (see §10) in favor of the official IFrame Player API + oEmbed approach described above.

### 6.5 Thumbnails

Playlist queue thumbnails use YouTube's public static image CDN directly: `https://i.ytimg.com/vi/<videoId>/mqdefault.jpg` — this is a standard, widely-used, unauthenticated image URL pattern (not an API call).

---

## 7. Views & Navigation

There's no URL routing; `currentView: 'playlists' | 'workspace' | 'notes'` in `AppContext` drives which top-level screen `Dashboard` renders:

- **`PlaylistsView`** — the course library: a grid of course cards with progress bars, resume/delete actions, aggregate stats, and an ad banner slot.
- **`NotesView`** — a three-pane notebook (folders → notes list → editor) independent of any specific course, for general note-taking.
- **`workspace`** (default) — `PlayerWorkspace` (video + controls) on the left, `WorkspaceRightPanel` (Playlist queue / Notes tabs) on the right. On mobile/tablet the right panel becomes a slide-in drawer instead of a fixed column; in Theater Mode the right panel drops below the player instead of beside it.

`Sidebar.tsx` is a legacy/alternate left-hand navigation component (course list + view switcher) that still exists in the tree but is not wired into the current `Dashboard` layout, which uses the `Header`'s center segmented control for the same navigation instead.

---

## 8. Feature Deep-Dives

### 8.1 Timestamped Notes ([components/NotesEditor.tsx](../src/components/NotesEditor.tsx))

- Rich text via **Tiptap** (`StarterKit` + `TaskList`/`TaskItem` for interactive checklists), with a **custom node extension, `TimestampNode`**: an atomic inline node rendered as a `<button class="timestamp-pill">▶ [mm:ss]</button>`. Clicking a pill calls the shared `seekTo(seconds)` (from `AppContext`, which calls the YouTube player's `seekTo`) — this is the "bidirectional sync" advertised on the landing page.
- "Insert Timestamp" (toolbar button, or `Alt+T` globally) reads `getCurrentPlayerTime()` and inserts a new timestamp node at the cursor.
- Notes support: title, 10 pastel background colors, pin-to-top, per-folder organization, live autosave (immediate to `localStorage`, debounced 800 ms to Supabase when signed in), and a "Copy" action that strips HTML to plain text for clipboard/export.
- `NotesView` also exposes folder rename/delete, search across title+content, and a "Pinned" smart filter.

### 8.2 Pomodoro / Focus Engine

Three separate UI surfaces share the same `AppContext` timer state:
- `PomodoroTimer.tsx` — a centered modal (circular SVG progress ring) opened via `isPomodoroExpanded`.
- `FloatingTimerWidget.tsx` — a draggable (mouse + touch), minimizable floating pill, independent of the modal.
- `CompactTimerBar` / the Header's timer pill — always-visible countdown + streak badge.

All sounds (`utils/audio.ts`) are generated at runtime with the Web Audio API (oscillators + gain envelopes) — there are no audio files, so there's nothing to license or fail to load. Completing a work sprint or finishing a course also fires `canvas-confetti`.

### 8.3 Daily Streak

A day only "counts" once `todayFocusMinutes >= 10` (watching video and/or running Pomodoro sprints both count, per the heartbeat in §4). Crossing that threshold increments `streakDays` exactly once per day and plays a success chime + confetti. Missing a full day zeroes the streak; being active "yesterday" but not reaching 10 minutes also zeroes it. All logic lives in `recordDailyActivity`/the stats-loading logic in `AppContext.tsx`.

### 8.4 Demo / Guided Tour ([components/DemoTourGuide.tsx](../src/components/DemoTourGuide.tsx))

A step-by-step onboarding overlay (referenced from `App.tsx`, gated on `isDemoMode`) that anchors to specific DOM elements via `id`/`data-tour` attributes sprinkled through `Header`, `PlaylistsView`, `PlayerWorkspace`, and `WorkspaceRightPanel` (e.g. `#tour-add-playlist-btn`, `#tour-video-player`, `#tour-note-timestamp-btn`).

### 8.5 Keyboard Shortcuts (global, `Dashboard` in `App.tsx`)

| Shortcut | Action |
|---|---|
| `Alt+T` | Insert a timestamp note at the current player time |
| `Alt+P` | Toggle Pomodoro start/pause |
| `Alt+S` | Toggle the Playlist queue panel |
| `Alt+N` | Toggle the Notes panel |
| `Alt+O` | Toggle the floating Pomodoro dock |

All are ignored while typing in an input/textarea/contenteditable (including inside the Tiptap editor).

### 8.6 Monetization surfaces

`AdBanner.tsx` and `WorkspaceAdBanner.tsx` are **not** a real ad network integration — despite an inline comment calling one slot a "Google AdSense Banner," both components only render static, hardcoded content (dev-humor quips, and self-referential "partner" cards for Next.js/Supabase/Buy-Me-a-Coffee/GitHub Copilot) with a manual "shuffle" button. There is no AdSense script, no third-party ad tag, and no impression tracking anywhere in the codebase today. A previous `AdsContainer.tsx` component was removed in favor of these two.

---

## 9. Styling & Design System

- Tailwind CSS with a small custom palette used consistently: ink `#121417`, lime accent `#EBF755`, pale blue `#D4E4FC`, cream background `#F9F8F5`, plus a hand-drawn accent font (`font-hand`) for landing-page annotations.
- A recurring `shadow-solid` / `shadow-solid-xs` / `shadow-solid-lg` utility plus `border-2 border-[#121417]` gives the app's signature "neo-brutalist sticker" look (thick black borders + offset drop shadows) on cards, buttons, and modals.
- Mobile responsiveness (the focus of the `feature/mobile-responsive` branch) is handled with Tailwind breakpoint variants throughout (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`), a slide-in drawer pattern for the workspace right panel on small screens, and a bottom-tab-style view switcher duplicated into `Sidebar`'s mobile block.

---

## 10. YouTube API Services Policy Compliance

FLO embeds third-party (public, creator-owned) YouTube videos and playlists, so it falls under YouTube's **API Services Terms of Service** and **Developer Policies**, even though it never calls the authenticated YouTube Data API v3 with an API key. A compliance pass (documented in full in [`docs/YOUTUBE_API_COMPLIANCE.md`](./YOUTUBE_API_COMPLIANCE.md)) found and fixed one real issue and hardened one smaller one:

1. **Removed:** use of YouTube's private, undocumented `youtubei/v1/browse` ("InnerTube") endpoint, previously reached through a dev-server proxy that spoofed `Origin`/`Referer` headers to impersonate `youtube.com`. This violated the policy against undocumented-API use and scraping. Playlist population now relies solely on the official IFrame Player API (`getPlaylist()`/`getVideoData()`) plus the official oEmbed endpoint — see §6.3–6.4.
2. **Added:** a 30-day staleness check (`metadataFetchedAt` / `needsMetadataRefresh`) so cached video titles/durations don't get stored indefinitely, in line with the Developer Policies' cap on retaining non-Analytics API data without refreshing it.

What was already compliant and didn't need changes: the player itself (official IFrame API, `rel=0`/`modestbranding=1` are supported parameters, no overlay on the player, an outbound "Watch on YouTube" link is always present), and the ad banners (static content placed outside/below the player, not a real ad network sold against the player).

See `docs/YOUTUBE_API_COMPLIANCE.md` for the full policy-by-policy breakdown, and the in-app "Privacy Policy" panel (`LandingPage.tsx`) for the user-facing disclosure.

---

## 11. Build, Config & Environment

- **Scripts** (`package.json`): `dev` (Vite dev server), `build` (`tsc -b && vite build`), `lint` (oxlint), `preview`.
- **Environment variables** (all `VITE_`-prefixed, read via `import.meta.env`, each with a hardcoded fallback so the app runs out-of-the-box):
  - `VITE_CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_DEV_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  - `VITE_BUY_ME_COFFEE_URL`
- **`vercel.json`** sets `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` (camera/mic/geolocation all denied) headers on every route, and rewrites everything to `/index.html` (required for an SPA with client-side view state).
- **`vite.config.ts`** is minimal: the React plugin plus `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` (accepting both prefixes for env vars). It no longer defines any dev-server proxy (the InnerTube proxy described in §10 was removed).

---

## 12. Known Tech Debt / Things to Watch

- `AppContext.tsx` is a ~1500-line God-object context; splitting it (e.g. courses vs. notes vs. pomodoro contexts) would help long-term maintainability but is a non-trivial refactor given how many components consume `useApp()`.
- Fallback Clerk/Supabase keys are committed in source (`main.tsx`, `lib/supabase.ts`). The Supabase key is a public anon key, which is only safe to expose *if* RLS policies are correctly scoped per `user_id` — **as of this writing they are not** (see `docs/SECURITY.md`: all four tables carry `USING (true)/WITH CHECK (true)` policies, so any holder of this anon key can read/write/delete any user's data directly via the Supabase API, bypassing the app entirely). The Clerk fallback is a `pk_test_*` publishable key (safe to expose). Fix the RLS policies before treating the anon key as low-risk.
- `Sidebar.tsx` appears to be dead/unused code relative to the current `Dashboard` layout — worth confirming and removing if truly unreferenced.
- No automated test suite exists in the repo yet (`package.json` has no `test` script).
- `AdBanner`/`WorkspaceAdBanner` reference "Google AdSense" only in a comment; if real ad monetization is added later, re-check §10's ad-placement rules (ads must stay outside/below the player, and any page carrying an ad plus YouTube API Data must also carry substantial non-YouTube content — both already true today).
