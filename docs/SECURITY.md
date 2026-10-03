# Security Audit — Findings & Remediation

A point-in-time security review of the live app (branch `feature/mobile-responsive`). Findings are ordered by severity. This file tracks what's fixed and what still needs action — update it as items are resolved.

## 1. CRITICAL — Supabase Row Level Security is effectively disabled

**Status: ✅ Fixed.** Clerk added as a Third-Party Auth provider in the Supabase dashboard, `src/lib/supabase.ts` now attaches the Clerk session token via `accessToken`, and the RLS policies below have been applied live in the database (verified: existing users' courses/notes/streaks still load and save correctly signed in on production).

`supabase_schema.sql` enables RLS on all four tables (`user_courses`, `user_folders`, `user_notes`, `user_streaks`) but every policy is:

```sql
CREATE POLICY "Users can manage own X" ON public.X
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

`USING (true)` / `WITH CHECK (true)` doesn't check anything — it allows any row to be read, written, or deleted by anyone. The app's own client code (`src/services/db.ts`) always adds `.eq('user_id', userId)` to scope queries, but that filter lives in the browser's JavaScript, not in the database. Since the Supabase anon key is public (embedded in `src/lib/supabase.ts` and shipped to every visitor's browser, by design — anon keys are meant to be public), **anyone can bypass the app entirely and call the Supabase REST API directly with an arbitrary `user_id`**, reading or overwriting any other user's courses, notes, folders, and streaks. This is exploitable today with nothing more than the anon key already present in the deployed JS bundle.

### Why `auth.uid()`-style policies won't work yet

The standard Supabase RLS fix (`USING (auth.uid() = user_id)`) relies on Supabase's own Auth issuing the JWT. This app uses **Clerk**, not Supabase Auth, and nothing currently connects the two — `src/lib/supabase.ts` never calls `supabase.auth.setSession()` or configures an access-token callback, so `auth.jwt()` / `auth.uid()` inside a Postgres policy have no idea who a Clerk-authenticated request is.

### Remediation path (two parts, both needed)

**A. Wire Clerk into Supabase as a third-party auth provider** (Supabase dashboard, one-time setup):
1. In the Supabase dashboard: **Authentication → Sign In / Providers → Third Party Auth**, add Clerk, pointing it at your Clerk instance's Frontend API URL (found in the Clerk dashboard under **API Keys**).
2. In code, pass Clerk's session token to Supabase on every request via the `accessToken` option when creating the client:
   ```ts
   // src/lib/supabase.ts
   export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
     accessToken: () => getClerkTokenSomehow(), // e.g. from Clerk's useAuth().getToken()
   });
   ```
   This requires restructuring `supabase.ts` to be created (or re-created) once a Clerk session exists, since the client needs a way to fetch the current token — typically done by creating the client inside a hook/context that has access to Clerk's `useAuth()`.

**B. Replace the SQL policies** with ones that check the verified identity instead of `true`:
```sql
DROP POLICY IF EXISTS "Users can manage own courses" ON public.user_courses;
CREATE POLICY "Users can manage own courses" ON public.user_courses
    FOR ALL
    USING (auth.jwt()->>'sub' = user_id)
    WITH CHECK (auth.jwt()->>'sub' = user_id);
-- repeat for user_folders, user_notes, user_streaks
```
(`auth.jwt()->>'sub'` is the Clerk user ID once the third-party auth integration in step A is active — it's populated only after that's configured, so applying this SQL before step A would lock everyone out.)

**Until this is done**, treat all data in these four tables as effectively public/tamperable. This is the top-priority fix.

## 2. LOW — Live Clerk secret key sitting unused on disk

**Status: ✅ Fixed.** Old key rolled/deleted in the Clerk dashboard, and the stale `CLERK_SECRET_KEY` line removed from `.env.local`.

`.env.local` (not committed to git — confirmed clean history) contains a real `CLERK_SECRET_KEY=sk_live_...`. Nothing in this codebase reads `CLERK_SECRET_KEY` (there's no backend to use it — confirmed no `api/` folder or serverless functions exist), so it serves no purpose here and is pure standing risk (laptop backups, screen shares, editor sync tools, etc.). Recommend:
- Delete the line from `.env.local`.
- Rotate that secret key in the Clerk dashboard as a precaution, since it has now also been printed in this chat session's transcript while investigating this file.

## 3. MEDIUM — Missing security response headers

**Status: ✅ Partially fixed.** Added to `vercel.json`:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: SAMEORIGIN` (blocks clickjacking via iframe embedding)
- `Cross-Origin-Opener-Policy: same-origin-allow-popups` (the `-allow-popups` variant so Clerk's OAuth popup flows keep working)

**Content-Security-Policy: 🧪 drafted as report-only, not yet enforcing.** Added as `Content-Security-Policy-Report-Only` in `vercel.json`, allowlisting the known origins this app actually needs: Clerk (`clerk.flo.protrack.club`, plus Cloudflare Turnstile for bot-protection challenges), Supabase (REST + realtime websocket), YouTube (IFrame API script, embedded player frame, thumbnail images), `noembed.com`/YouTube's oEmbed endpoint (title lookups), and Google Fonts. `style-src` includes `'unsafe-inline'` since the app sets inline `style` attributes in several places (progress bars, the draggable timer widget, the demo tour's positioning) and Clerk's own components likely do too.

Report-only means nothing is blocked yet — violations just get logged to the browser console. Before flipping it to enforcing (`Content-Security-Policy`), do a full pass on the live site with DevTools console open and confirm no CSP violation reports appear for: landing page load, Clerk sign-in/sign-up (both Google and email), entering the demo, embedding and playing a YouTube video, a playlist's titles resolving, and Google Fonts rendering. Add any missing origin to the relevant directive if something's flagged, then switch the header key to enforcing.

## 4. LOW — Unvalidated free-text video ID in bulk import

**Status: ✅ Fixed.** `src/components/AddCourseModal.tsx`'s "Batch Multi-Video" import used the raw pasted string as a `youtubeId` verbatim if it failed to parse as a URL, with no format check. Added an 11-character YouTube-ID format validation, falling back to a placeholder ID otherwise. Also added `encodeURIComponent()` around `playlistId`/`youtubeId` when building the "Watch on YouTube" link in `src/components/PlayerWorkspace.tsx`, since it was interpolated into a URL unencoded.

## Reviewed and found OK

- **XSS**: no `dangerouslySetInnerHTML`, `innerHTML =`, `eval(`, or `new Function(` anywhere in `src/`. Notes content goes through Tiptap/ProseMirror's schema-based HTML parsing (not raw injection), and note previews render through React's auto-escaped JSX text nodes.
- **Auth trust boundary**: the `userId` used to scope every Supabase call always comes from Clerk's authenticated `user.id` (via `useUser()`), never from a client-controlled value — the only gap is that the database itself doesn't verify this (see #1).
- **External links**: every `target="_blank"` link already carries `rel="noopener noreferrer"` or `rel="noreferrer"`.
- **Secrets in git history**: `.env.local` / `.env` have never been committed; only the placeholder `.env.example` is tracked.
