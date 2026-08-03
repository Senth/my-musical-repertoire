# Phase 0: Handoff

**Implementer:** this spec is your plan. Build it phase-by-phase using the
**Phases** section below; each phase is sized for one focused session.

- Spec file: `docs/specs/pwa-support.md` (this file).
- Tracking issue: [#94](https://github.com/Senth/my-musical-repertoire/issues/94)
  (labeled `feature`, board column **In Progress**). The phase checklist lives in the
  issue body — tick items as you complete them.
- This spec also fully covers [#14](https://github.com/Senth/my-musical-repertoire/issues/14)
  (Firestore offline persistence + offline-first UX) — see the #14 note under
  *Decisions locked*. No extra work beyond Phases 4 and 7.
- After all phases verify working, close both via `Closes #94` and `Closes #14` in the
  PR body, then run `scripts/sync-todo.sh` to refresh `TODO.md`.
- Project conventions: see `.claude/CLAUDE.md` (run tests + lint and fix all issues
  incl. pre-existing; manually verify on web via Playwright, port 8081 main / 8082
  worktree; login senth.wallace@gmail.com).
- **Extra for this feature:** the service worker only registers in production builds,
  so PWA behaviour must be verified against a served static export
  (`yarn build:web` → `npx serve dist -p 8083`), not the Expo dev server.

---

# PWA Support

Issues: [#94](https://github.com/Senth/my-musical-repertoire/issues/94) (PWA support),
[#14](https://github.com/Senth/my-musical-repertoire/issues/14) (Firestore offline
persistence + offline-first UX — fully absorbed here, see below).

## What

Make the web app a real installable PWA: no address bar, an app icon, an offline-capable
app shell with persistent Firestore data, a screen that stays awake while practising, and
navigation/install behaviour that never interrupts a coach session.

## Why

The issue asks only to "hide the address bar", but the manifest alone produces a worse
app, not a better one:

- **Installed but offline-broken.** `PROJECT.md` lists offline as a requirement and
  assumes Firestore persistence handles it. Two things are missing: without a service
  worker the JS bundle never loads offline (so persistence is moot), and
  `config/firebase.ts:25` uses plain `getFirestore(app)` — memory cache only, no
  IndexedDB. Today an installed app with no wifi is a white screen.
- **Screen sleep kills the practice loop.** A coach block runs 5–10 minutes with the
  device untouched on the music desk. The screen dims, and the user reads it as a lost
  session. This is the single highest-value fix in the feature.
- **No address bar means no escape from a mid-session interruption.** Chrome Android's
  uncontrolled install infobar and the system back gesture both become session-hostile
  once the browser chrome is gone.

### Decisions locked during grilling

- **Scope: full installable PWA**, not the manifest layer alone. Manifest, icons, service
  worker + shell cache, Firestore persistence, wake lock, install gating, back guard,
  offline indicator.
- **Service worker: hand-rolled runtime caching**, no Workbox/serwist, no precache
  manifest, no build step. Expo SDK 55's Metro static export ships no SW tooling
  (verified: nothing in `@expo/cli/build/src/export/`), and a precache manifest would
  need regenerating on every build.
- **SW updates: waiting worker + gated in-app prompt.** No `skipWaiting`. Never
  auto-reload — a reload mid-block loses unsaved block form input.
- **Wake lock: coach + both standalone practice screens**, released on pause and when
  the tab hides.
- **Install prompt: always `preventDefault()`**, show a gated Overview card. Capturing
  is mandatory regardless of UI — an uncaptured `beforeinstallprompt` lets Chrome
  Android pop its mini-infobar mid-block.
- **Back guard: web `popstate` trap**, not `BackHandler`. Verified
  `react-native-web`'s `BackHandler` is a no-op stub that only `console.error`s
  (`node_modules/react-native-web/dist/exports/BackHandler/index.js:14`), so the
  `Platform.OS === "android"` path in `hooks/use-up-navigation.ts` never runs on web.
- **Firestore: `persistentLocalCache` + `persistentMultipleTabManager`, web only.**
  Multi-tab avoids the `failed-precondition` throw when the installed PWA and a browser
  tab are open together. Native keeps `getFirestore` (the JS SDK has no IndexedDB there).
- **Display: `standalone`, orientation `any`.** Status bar stays (wall clock matters
  while timing practice); tablets can sit landscape on the music desk. `app.json`
  keeps `portrait` for native — the manifest value only affects the installed web app.
- **No `viewport-fit=cover`.** Corrects an assumption from the pedagogy review: standalone
  only overlaps the status/gesture bars if you opt in. Default keeps content clear of
  both, so no `env(safe-area-inset-*)` plumbing is needed — the codebase uses
  `react-native-safe-area-context` nowhere today and this feature does not introduce it.
- **New app icon**: piano keys with G-clef and C-clef, purple ground / white keys /
  dark clefs. Authored once as SVG, rasterized to every existing icon target.
- **No in-app reload/reset escape hatch.** Coach already exits to Overview, the back
  guard adds "Pause & exit", and the Android app switcher can force-relaunch. A visible
  reset button is a mid-practice mis-tap risk for a failure mode we have no evidence of.
- **No new persisted signals.** Install/standalone state says nothing about how a piece
  is going.
- **#14 is absorbed, not deferred.** Its three items map onto this spec: *enable
  persistence* → Phase 4; *offline-first UX (sync indicators)* → the offline bar, Phase 4;
  *verify across all features* → the Phase 7 offline sweep. Its remaining item,
  *optimistic updates*, needs **no code** — `use-pieces.ts:73`, `use-sections.ts:87`,
  `use-techniques.ts:102` and `use-session-presets.ts:114` already read via `onSnapshot`,
  which with `persistentLocalCache` fires from cache immediately and includes pending
  local writes. That is optimistic-update behaviour by construction. The one-shot
  `getDocs` reads (`use-last-practice-log.ts:150`, `use-pieces.ts:168`,
  `use-sections.ts:117`) fall back to cache when the server is unreachable, so they also
  work offline. Close #14 alongside #94.

### Already correct — do not "fix"

Two pedagogy-review concerns are already handled; verify, don't rewrite:

- `app/(app)/session/coach.tsx:105` computes elapsed via wall-clock
  `diffSec(session.currentBlockStartedAt)`. The `setInterval` at `coach.tsx:65` is a
  re-render tick only, so backgrounding cannot under-count.
- `utils/session-storage.ts` persists the active session to AsyncStorage, and
  `hooks/use-active-session.ts` rehydrates on mount — a reload mid-session recovers.

## Data Model

**No Firestore changes.** No new collections, no new fields, no rules changes, so no
`yarn deploy:dev` needed.

New AsyncStorage key only, alongside the existing keys in `utils/session-storage.ts`:

| Key | Value | Purpose |
|---|---|---|
| `installPromptDismissed:<uid>` | `"1"` | User dismissed the install card; never offer again |

Firestore initialization changes in `config/firebase.ts`:

```ts
const db =
  Platform.OS === "web"
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      })
    : getFirestore(app);
```

## UI Flow

### New static assets — `public/` (copied verbatim into `dist/` by `expo export`)

Verified: `@expo/cli/build/src/export/exportApp.js:188` copies the public folder to the
output root.

```
public/
  manifest.webmanifest
  sw.js
  icons/{icon-192.png,icon-512.png,maskable-192.png,maskable-512.png}
```

`manifest.webmanifest`:

| Field | Value |
|---|---|
| `name` | `My Musical Repertoire` |
| `short_name` | `Repertoire` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `any` |
| `background_color` | `#FFFFFF` |
| `theme_color` | `#7B1FA2` (light `primary` from `app/_layout.tsx:15`) |
| `icons` | 192 + 512 `any`, 192 + 512 `maskable` |

### `app/+html.tsx` (new — Expo Router's static HTML shell)

Adds to `<head>`: the manifest link, `theme-color` metas (light `#7B1FA2`, dark
`#CE93D8` via `media="(prefers-color-scheme: dark)"`), apple-touch-icon, and a viewport
override adding `interactive-widget=resizes-content` so the soft keyboard resizes the
layout instead of pushing the coach's sticky bars and Save button off screen.

Must preserve Expo's default shell (`ScrollViewStyleReset`, `#root` reset styles) — copy
from Expo Router's documented `+html.tsx` template rather than writing from scratch.

### `public/sw.js` — routing table

| Request | Strategy |
|---|---|
| non-`GET` | untouched (falls through to network) |
| cross-origin (Firestore, Google APIs, fonts) | untouched — never intercept, Firestore manages its own offline queue |
| `mode === "navigate"` | network-first → fall back to cached `/index.html` shell |
| `/_expo/static/*` (content-hashed) | cache-first |
| other same-origin `GET` | stale-while-revalidate |

Install caches `/` and `/index.html`. Activate deletes caches whose key ≠ current
version constant. **No `skipWaiting`, no `clients.claim`.**

Because assets are cached on first use, a fresh install must load online once before it
works offline — already true anyway, since the user has to sign in.

### `hooks/use-service-worker.ts` (web-only, `.web.ts` + a no-op `.ts` for native)

- Registers `/sw.js` on load, **only when `process.env.NODE_ENV === "production"`**.
  Dev on :8081 stays SW-free so Metro hot reload isn't lying about stale bundles.
- Watches `registration.waiting` / `updatefound` and exposes `updateReady` +
  `applyUpdate()` (posts `SKIP_WAITING`, then reloads on `controllerchange`).

### `components/ui/UpdateBanner.tsx`

Paper `Snackbar` — "New version available" / action "Reload". Rendered from
`app/_layout.tsx`. **Suppressed whenever an active session exists in AsyncStorage**;
re-offered once the user is back on Overview with no session.

### `hooks/use-wake-lock.ts` (web-only impl + native no-op)

`useWakeLock(enabled: boolean)`:

- Acquires `navigator.wakeLock.request("screen")` when `enabled`, releases when not.
- Re-acquires on `visibilitychange` → visible (the browser silently drops the lock when
  the tab hides).
- Fully guarded — `navigator.wakeLock` is absent on iOS Safari < 16.4 and the request
  rejects on low battery. Failure is silent, never user-facing.

Call sites:

| Screen | `enabled` when |
|---|---|
| `app/(app)/session/coach.tsx` | session active **and** not paused (`use-session-pause`) |
| `app/(app)/piece/[id]/practice.tsx` | screen focused |
| `app/(app)/technique/[id]/practice.tsx` | screen focused |

### `hooks/use-install-prompt.ts` + `components/ui/InstallCard.tsx`

- Listens for `beforeinstallprompt`, **always** `preventDefault()`s and stashes the event.
- Card renders on Overview only when **all** hold: event captured; not already standalone
  (`window.matchMedia("(display-mode: standalone)").matches` — also covers iOS
  `navigator.standalone`); no active session in AsyncStorage; user has ≥1 completed
  session; not previously dismissed.
- Actions: **Install** → `prompt()`; **Not now** → writes `installPromptDismissed:<uid>`.
- Clears the stashed event on `appinstalled`.

### `hooks/use-coach-exit-guard.ts` (web-only)

On coach mount: `history.pushState({ coachGuard: true }, "")`. On `popstate`, re-push the
sentinel and open a Paper `Dialog`:

> **Leave session?** Your progress is saved.
> [Keep practicing] [Pause & exit]

"Pause & exit" pauses through the existing `use-session-pause` path (so elapsed time
stays correct) and `router.replace`s to Overview. Unmount removes the listener and, if
the sentinel is still on the stack, pops it.

### `components/ui/OfflineBar.tsx` + `hooks/use-online-status.ts`

`navigator.onLine` seeded, updated by `online`/`offline` events. A slim bar in
`app/_layout.tsx` **inside `PaperProvider`, above `<Slot />`** so every screen including
login and coach shows it. Copy: "Offline — changes will sync when you reconnect."

### App icon — new art

Author `assets/images/icon.svg` as the single source: rounded-square purple `#7B1FA2`
ground, white keys with black keys as negative space across the lower half, G-clef and
C-clef in near-black overlaid. Three flat tonal levels so it survives 48×48.

Rasterize (rsvg-convert / ImageMagick) to every existing target:

| Output | Size | Note |
|---|---|---|
| `assets/images/icon.png` | 1024² | native app icon |
| `assets/images/favicon.png` | 48² | browser tab |
| `assets/images/android-icon-foreground.png` | 512² | art inside the 66% adaptive safe zone |
| `assets/images/splash-icon.png` | 512² | splash |
| `public/icons/icon-{192,512}.png` | 192², 512² | manifest `any` |
| `public/icons/maskable-{192,512}.png` | 192², 512² | art inside the 80% safe zone, purple bleeds to edge |

### `firebase.json` — hosting headers

`sw.js` and `manifest.webmanifest` must not be long-cached, or an update can never land:

```json
"headers": [
  { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
  { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
]
```

### i18n

New keys in `i18n/locales/en-US.json` under existing top-level groups (`common`, `screen`):
offline bar text, update-available + reload, install card title/body/install/not-now,
leave-session dialog title/body/keep/exit.

## Logging

**None.** No new Firestore writes, no new recommendation signals, no lifecycle changes.
The only new persisted state is the local `installPromptDismissed:<uid>` flag.

## Out of Scope

- `viewport-fit=cover` / edge-to-edge and any `react-native-safe-area-context` adoption.
- Precache manifests, Workbox/serwist, or any new build step.
- Push notifications (`PROJECT.md`: explicitly not needed).
- Background Sync API — Firestore's own offline write queue covers this.
- Play Store / TWA packaging.
- Any in-app reload / "reset app" control.
- Storing install or display-mode state in Firestore.
- Offline caching of Firebase Storage assets (PDFs — feature doesn't exist yet).
- Changing coach timing, session persistence, or `hooks/use-up-navigation.ts` behaviour
  outside the coach screen.

## Phases

**Phase 1 — Icon art**
- Author `assets/images/icon.svg` (purple ground, white keys, dark G-clef + C-clef).
- Rasterize all targets in the icon table above, including the two maskable variants
  with the 80% safe zone.
- Sanity-check legibility at 48×48 and under a circular maskable crop.

**Phase 2 — Manifest + HTML shell (the issue's literal ask)**
- Add `public/manifest.webmanifest` and `public/icons/*`.
- Add `app/+html.tsx` from Expo Router's template, plus manifest link, light/dark
  `theme-color` metas, apple-touch-icon, and `interactive-widget=resizes-content`.
- `yarn build:web`, serve `dist/`, confirm Chrome offers install and the installed app
  opens with no address bar.

**Phase 3 — Service worker + update flow**
- Add `public/sw.js` with the routing table above (no `skipWaiting`).
- Add `hooks/use-service-worker` (prod-only registration) and
  `components/ui/UpdateBanner.tsx`, wired in `app/_layout.tsx`, suppressed during an
  active session.
- Add the `firebase.json` no-cache headers.
- Verify: offline reload of a served `dist/` still renders the shell; a rebuilt `sw.js`
  surfaces the banner and only reloads on tap.

**Phase 4 — Offline data + offline bar**
- Switch `config/firebase.ts` to `initializeFirestore` + `persistentLocalCache` +
  `persistentMultipleTabManager` on web; leave native on `getFirestore`.
- Add `hooks/use-online-status` + `components/ui/OfflineBar.tsx` in `app/_layout.tsx`.
- Verify: load online, go offline, reload — repertoire still renders from IndexedDB;
  log a block offline, reconnect, confirm the write flushes.
- No code needed for optimistic updates (see the #14 note above), but confirm an offline
  edit appears in the list immediately via the existing `onSnapshot` subscriptions.

**Phase 5 — Wake lock**
- Add `hooks/use-wake-lock` (web impl + native no-op) with `visibilitychange`
  re-acquisition and full feature guards.
- Wire into coach (active + not paused) and both standalone practice screens.

**Phase 6 — Install gating + coach back guard**
- Add `hooks/use-install-prompt` (always `preventDefault()`) and
  `components/ui/InstallCard.tsx` on Overview with the five gating conditions.
- Add `hooks/use-coach-exit-guard` (popstate sentinel) + the leave-session dialog,
  wired into `app/(app)/session/coach.tsx`.
- Add all new i18n keys.

**Phase 7 — Verify (lint, tests, Playwright e2e)**
- Full test suite + Biome/ESLint; fix everything, including pre-existing issues.
- Unit tests for the pure bits: SW route-strategy selection, install-card gating
  predicate, online-status reducer.
- Playwright against a **production** build (`yarn build:web` → `npx serve dist -p 8083`),
  login senth.wallace@gmail.com:
  1. Manifest is served, parses, and Chrome reports the app as installable.
  2. Service worker registers and reaches `activated`.
  3. Go offline → reload → app shell renders (not the browser error page).
  4. **Offline sweep across all features (satisfies #14's "verify across all features").**
     Offline, with a warm cache, each of these renders and mutates locally, and every
     mutation reaches Firestore after reconnecting:
     - pieces list + piece detail; create, edit, delete a piece
     - sections panel; create, edit, reorder, delete a section
     - techniques list + detail; create and edit a technique
     - session presets: create and edit
     - the standalone piece and technique practice screens (log a practice)
     - overview suggestions render from cached data
     - a full coach session: setup → blocks → summary, generated and logged offline
  5. Offline → log a practice block → back online → write reaches Firestore.
  6. Optimistic update: offline, edit a piece title → list row updates immediately
     (no reload, no reconnect).
  7. Offline bar appears offline, disappears on reconnect.
  8. Wake lock: sentinel is requested on entering a coach block and released on pause
     (assert via a `navigator.wakeLock` spy — a real lock can't be observed headless).
  9. Install card hidden while a session is active; visible on Overview after a
     completed session; stays hidden after "Not now" + reload.
  10. Coach back guard: `history.back()` on the coach screen shows the dialog;
      "Keep practicing" stays on the block; "Pause & exit" lands on Overview with the
      session paused and resumable.
  11. Update banner: with a session active it stays hidden; on Overview with no session
      it appears and only reloads when tapped.
- Dev-server regression check on :8081 — confirm **no** service worker registers and hot
  reload is unaffected.
- Android hardware-back and real wake-lock behaviour can't be exercised headless — flag
  both for a manual device check on the installed PWA.
