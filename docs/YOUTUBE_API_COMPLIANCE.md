# YouTube API Services — Compliance Notes

FLO embeds public YouTube videos/playlists inside a distraction-free workspace. This puts the app under YouTube's **API Services Terms of Service** (`developers.google.com/youtube/terms/api-services-terms-of-service`) and its linked **Developer Policies**, even without ever calling the authenticated YouTube Data API v3. This document tracks what those policies require, how FLO meets each one today, and what changed to get there. Re-read it (and re-check the live policy pages, since Google updates them) before making any change to how videos/playlists are fetched, displayed, or monetized.

Related: the "How it works" section of [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) §6 covers the same code from a pure engineering angle.

## 1. Embedding & the player

| Requirement | FLO's approach | Status |
|---|---|---|
| Use the official player/API, don't build a custom one | [`PlayerWorkspace.tsx`](../src/components/PlayerWorkspace.tsx) loads `https://www.youtube.com/iframe_api` and instantiates `YT.Player` — the standard, documented IFrame Player API | ✅ Compliant |
| Don't overlay, obstruct, or hide player controls | No DOM overlays are placed on top of the iframe; `fs`, `modestbranding`, `rel` are all official, documented `playerVars` | ✅ Compliant |
| Don't remove or obscure YouTube's attribution/branding | Logo is never hidden or stripped; an explicit "Watch on YouTube" outbound link is always shown next to the player | ✅ Compliant |
| Age-restricted / embedding-disabled videos | Handled by YouTube itself (redirects/errors at the iframe level) — no workaround is attempted | ✅ Compliant by inaction |

## 2. Fetching titles, durations & playlist contents

| Requirement | FLO's approach | Status |
|---|---|---|
| Only access YouTube data through documented means; no undocumented/internal APIs; no scraping | Playlist contents come from the IFrame Player API's own `getPlaylist()`/`getVideoData()` methods (part of the official, documented player API). Titles/durations are resolved via YouTube's public, documented **oEmbed** endpoint (`youtube.com/oembed`), with `noembed.com` (a third-party oEmbed mirror) tried first purely for latency | ✅ Compliant (see history below) |
| — | ~~Previously~~: a `fetchPlaylistFromInnerTube()` helper called YouTube's *private* `youtubei/v1/browse` endpoint through a dev-server proxy that spoofed `Origin`/`Referer` to `youtube.com`, to bulk-fetch full playlist metadata in one request. | ❌ Was non-compliant — **removed** (see §5) |

## 3. Storing fetched data

| Requirement | FLO's approach | Status |
|---|---|---|
| Non-Analytics API Data must not be retained indefinitely without periodic refresh (policy caps this at 30 days) | Every `VideoItem` carries `metadataFetchedAt`. `needsMetadataRefresh()` flags anything missing or older than 30 days, and the title-resolution pipeline treats those exactly like never-resolved videos, re-fetching and re-stamping them | ✅ Compliant (added — see §5) |
| Give users a way to delete their own stored data | `resetAllData()` (Settings/reset flow) clears `localStorage`; Supabase rows are deleted via `deleteUserCourseFromCloud`/`deleteUserNoteFromCloud`/etc. when a user deletes a course/note/folder | ✅ Compliant |

## 4. Advertising / monetization

| Requirement | FLO's approach | Status |
|---|---|---|
| No ads placed on/within the YouTube player itself | `AdBanner`/`WorkspaceAdBanner` render in their own bordered cards, always outside and below the player element, never as an overlay | ✅ Compliant |
| A page with ads + YouTube API Data must carry substantial independent content | Every page that shows an ad banner (`PlaylistsView`, workspace) also carries the app's own substantial UI: notes, progress tracking, streaks, folders — not just YouTube data | ✅ Compliant |
| — | Today's "ads" are static, hardcoded self-referential content (dev jokes, partner links) — **not** a live ad network. If a real ad network (e.g. AdSense) is wired in later, re-verify against this table first | ⚠️ Re-check before adding real ads |

## 5. Change history

- **Removed** `fetchPlaylistFromInnerTube()`, its call sites (`AppContext.tsx`, `PlayerWorkspace.tsx`, `AddCourseModal.tsx`), and the `vite.config.ts` dev-server proxy that forwarded `/api/yt-browse` to YouTube's private `youtubei/v1/browse` endpoint with spoofed headers. No production deployment ever had a matching serverless function, so this was dormant in prod, but it ran in every local dev session and was a clear Developer Policy violation on its face (undocumented API + scraping-shaped request spoofing).
- **Added** `metadataFetchedAt` on `VideoItem` and `needsMetadataRefresh()` in `src/utils/youtubeTitles.ts`, wired into `resolvePlaylistTitles()` and the resolution effect in `AppContext.tsx`, so cached YouTube metadata is re-validated every 30 days instead of being kept forever.

## 6. What FLO does *not* do (and why that keeps this list short)

- No OAuth/consent flow against a user's own YouTube/Google account, no access to their subscriptions, watch history, or private playlists — FLO only ever reads **public** playlist/video data.
- No YouTube Data API v3 usage, so no API key, no quota to manage, no per-request authorization scopes to justify.
- No re-uploading, downloading, or redistributing of video files — playback is always streamed live through YouTube's own player.

## 7. Where this is disclosed to users

The in-app "Privacy Policy" panel (`src/components/LandingPage.tsx`) includes a **YouTube API Services** section stating that playback is streamed through the official IFrame Embed API, that FLO does not store or redistribute video files, and linking out to YouTube's Terms of Service and Google's Privacy Policy. Keep that section in sync with this document if the integration changes.
