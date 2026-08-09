# PWA support

Tracking issues: [#94](https://github.com/Senth/my-musical-repertoire/issues/94),
[#14](https://github.com/Senth/my-musical-repertoire/issues/14)

## 1. What

The web app is a real installable PWA: no address bar, an app icon, an
offline-capable app shell with persistent Firestore data, a screen that stays
awake while practising, and navigation and install behaviour that never
interrupts a coach session.

## 2. Why

The original issue asked only to "hide the address bar", but the manifest alone
produces a worse app, not a better one:

- **Installed but offline-broken.** Offline is a stated project requirement, and
  two things were missing: without a service worker the JS bundle never loads
  offline (so Firestore persistence is moot), and the app used plain
  `getFirestore(app)` — memory cache only, no IndexedDB. An installed app with no
  wifi was a white screen.
- **Screen sleep kills the practice loop.** A coach block runs 5–10 minutes with
  the device untouched on the music desk. The screen dims and the user reads it
  as a lost session. This is the single highest-value fix in the feature.
- **No address bar means no escape from a mid-session interruption.** Chrome
  Android's uncontrolled install infobar and the system back gesture both become
  session-hostile once the browser chrome is gone.

### Decisions locked

- **Hand-rolled service worker**, no Workbox/serwist, no precache manifest, no
  build step. Expo SDK 55's Metro static export ships no SW tooling, and a
  precache manifest would need regenerating on every build.
- **SW updates: waiting worker + gated in-app prompt.** No `skipWaiting`, never
  auto-reload — a reload mid-block loses unsaved block form input.
- **Install prompt: always `preventDefault()`.** Capturing is mandatory
  regardless of UI; an uncaptured `beforeinstallprompt` lets Chrome Android pop
  its mini-infobar mid-block.
- **Back guard: a web `popstate` trap, not `BackHandler`.**
  `react-native-web`'s `BackHandler` is a no-op stub that only `console.error`s,
  so the `Platform.OS === "android"` path in `hooks/use-up-navigation.ts` never
  runs on web ([`back-button-navigation.md`](back-button-navigation.md)).
- **Firestore: `persistentLocalCache` + `persistentMultipleTabManager`, web
  only.** Multi-tab avoids the `failed-precondition` throw when the installed PWA
  and a browser tab are open together. Native keeps `getFirestore` — the JS SDK
  has no IndexedDB there.
- **Display `standalone`, orientation `any`.** The status bar stays, because the
  wall clock matters while timing practice; tablets can sit landscape on the
  music desk. `app.json` keeps `portrait` for native — the manifest value only
  affects the installed web app.
- **No `viewport-fit=cover`.** Standalone only overlaps the status/gesture bars
  if you opt in. The default keeps content clear of both, so no
  `env(safe-area-inset-*)` plumbing is needed and
  `react-native-safe-area-context` is not adopted.
- **No in-app reload/reset escape hatch.** The coach already exits to Overview,
  the back guard adds "Pause & exit", and the app switcher can force-relaunch. A
  visible reset button is a mid-practice mis-tap risk for a failure mode with no
  evidence behind it.
- **No new persisted signals.** Install/standalone state says nothing about how a
  piece is going.

### #14 is absorbed, not deferred

Offline persistence and offline-first UX ship here. *Optimistic updates* need
**no code**: `use-pieces`, `use-sections`, `use-techniques` and
`use-session-presets` all read via `onSnapshot`, which with `persistentLocalCache`
fires from cache immediately and includes pending local writes — optimistic
behaviour by construction. The one-shot `getDocs` reads
(`use-last-practice-log`, and the by-id reads in `use-pieces` / `use-sections`)
fall back to cache when the server is unreachable, so they also work offline.

### Already correct — do not "fix"

- The coach computes elapsed via wall-clock diffs from
  `currentBlockStartedAt`; its `setInterval` is a re-render tick only, so
  backgrounding cannot under-count.
- `utils/session-storage.ts` persists the active session and
  `hooks/use-active-session.ts` rehydrates on mount, so a reload mid-session
  recovers.

## 3. Data model

**No Firestore changes** — no new collections, no new fields, no rules changes,
so no `yarn deploy:dev` needed.

One new AsyncStorage key alongside the existing ones:

| Key | Value | Purpose |
| --- | --- | --- |
| `installPromptDismissed:<uid>` | `"1"` | User dismissed the install card; never offer again |

Firestore initialization (`config/firebase.ts`):

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

## 4. Static assets

`public/` is copied verbatim into `dist/` by `expo export`:

```
public/
  manifest.webmanifest
  sw.js
  icons/{icon-192.png,icon-512.png,maskable-192.png,maskable-512.png}
```

`manifest.webmanifest`:

| Field | Value |
| --- | --- |
| `name` | `My Musical Repertoire` |
| `short_name` | `Repertoire` |
| `start_url` / `scope` | `/` |
| `display` | `standalone` |
| `orientation` | `any` |
| `background_color` | `#FFFFFF` |
| `theme_color` | `#7B1FA2` (light `primary`) |
| `icons` | 192 + 512 `any`, 192 + 512 `maskable` |

`app/+html.tsx` — Expo Router's static HTML shell — adds the manifest link,
`theme-color` metas (light `#7B1FA2`, dark `#CE93D8` via
`media="(prefers-color-scheme: dark)"`), the apple-touch-icon, and a viewport
override adding `interactive-widget=resizes-content` so the soft keyboard resizes
the layout instead of pushing the coach's sticky bars and Save button off screen.
It must preserve Expo's default shell (`ScrollViewStyleReset`, `#root` reset
styles).

### App icon

`assets/images/icon.svg` is the single source: rounded-square purple `#7B1FA2`
ground, white keys with black keys as negative space across the lower half, and a
G-clef and C-clef in near-black overlaid. Three flat tonal levels, so it survives
48×48. Rasterized to every existing target:

| Output | Size | Note |
| --- | --- | --- |
| `assets/images/icon.png` | 1024² | native app icon |
| `assets/images/favicon.png` | 48² | browser tab |
| `assets/images/android-icon-foreground.png` | 512² | art inside the 66% adaptive safe zone |
| `assets/images/splash-icon.png` | 512² | splash |
| `public/icons/icon-{192,512}.png` | 192², 512² | manifest `any` |
| `public/icons/maskable-{192,512}.png` | 192², 512² | art inside the 80% safe zone, purple bleeds to edge |

### `firebase.json` hosting headers

`sw.js` and `manifest.webmanifest` must not be long-cached, or an update can
never land:

```json
"headers": [
  { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] },
  { "source": "/manifest.webmanifest", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
]
```

## 5. Service worker

`public/sw.js` routing table:

| Request | Strategy |
| --- | --- |
| non-`GET` | untouched — falls through to network |
| cross-origin (Firestore, Google APIs, fonts) | untouched — never intercept; Firestore manages its own offline queue |
| `mode === "navigate"` | network-first → fall back to the cached `/index.html` shell |
| `/_expo/static/*` (content-hashed) | cache-first |
| other same-origin `GET` | stale-while-revalidate |

Install caches `/` and `/index.html`. Activate deletes caches whose key differs
from the current version constant. **No `skipWaiting`, no `clients.claim`.**

Because assets are cached on first use, a fresh install must load online once
before it works offline — already true anyway, since the user has to sign in.

`hooks/use-service-worker` (web impl + native no-op) registers `/sw.js` on load
**only when `process.env.NODE_ENV === "production"`**, so the dev server stays
SW-free and Metro hot reload is never lying about stale bundles. It watches
`registration.waiting` / `updatefound` and exposes `updateReady` +
`applyUpdate()`, which posts `SKIP_WAITING` and reloads on `controllerchange`.

`components/ui/UpdateBanner.tsx` is a Paper `Snackbar` — "New version available"
/ "Reload" — rendered from `app/_layout.tsx` and **suppressed whenever an active
session exists**, re-offered once the user is back on Overview with none.

## 6. Runtime behaviour

### Wake lock

`useWakeLock(enabled)` (web impl + native no-op) acquires
`navigator.wakeLock.request("screen")` when enabled, releases when not, and
re-acquires on `visibilitychange` → visible, because the browser silently drops
the lock when the tab hides. Fully guarded — `navigator.wakeLock` is absent on
iOS Safari < 16.4 and the request rejects on low battery. Failure is silent,
never user-facing.

| Screen | Enabled when |
| --- | --- |
| coach | a block is actually running: session active, not paused, `currentBlockStartedAt` set |
| piece practice | screen focused |
| technique practice | screen focused |

### Install card

`hooks/use-install-prompt` listens for `beforeinstallprompt`, **always**
`preventDefault()`s and stashes the event, clearing it on `appinstalled`.

`components/ui/InstallCard.tsx` renders on Overview only when **all** hold: the
event was captured; not already standalone (`display-mode: standalone`, which
also covers iOS `navigator.standalone`); no active session; the user has ≥1
completed session; not previously dismissed. **Install** calls `prompt()`; **Not
now** writes `installPromptDismissed:<uid>`. The predicate lives in
`utils/install-gating.ts` and is unit-tested.

### Coach exit guard

On coach mount, `history.pushState({ coachGuard: true }, "")`. On `popstate` the
sentinel is re-pushed and a Paper `Dialog` opens:

> **Leave session?** Your progress is saved.
> [Keep practicing] [Pause & exit]

"Pause & exit" pauses through the existing `use-session-pause` path, so elapsed
time stays correct, then `router.replace`s to Overview. Unmount removes the
listener and pops the sentinel if it is still on the stack.

### Offline bar

`hooks/use-online-status` seeds from `navigator.onLine` and updates on
`online`/`offline`. `components/ui/OfflineBar.tsx` is a slim bar rendered in
`app/_layout.tsx` **inside `PaperProvider`, above `<Slot />`**, so every screen
including login and the coach shows it: "Offline — changes will sync when you
reconnect."

## 7. Logging

**None.** No new Firestore writes, no new recommendation signals, no lifecycle
changes. The only new persisted state is the local `installPromptDismissed:<uid>`
flag.

## 8. Verifying changes

The service worker registers only in production builds, so PWA behaviour must be
checked against a served static export (`yarn build:web` → `npx serve dist -p
8083`), **not** the Expo dev server. Android hardware-back and real wake-lock
behaviour cannot be exercised headless and need a manual device check on the
installed PWA.

## 9. Out of scope

- **`viewport-fit=cover` / edge-to-edge** and any
  `react-native-safe-area-context` adoption.
- **Precache manifests, Workbox/serwist**, or any new build step.
- **Push notifications** — `PROJECT.md` explicitly does not want them.
- **Background Sync API** — Firestore's own offline write queue covers this.
- **Play Store / TWA packaging.**
- **Any in-app reload / "reset app" control.**
- **Storing install or display-mode state in Firestore.**
- **Offline caching of Firebase Storage assets** (PDFs — the feature does not
  exist yet).
- **Changing coach timing, session persistence, or `use-up-navigation` behaviour
  outside the coach screen.**
