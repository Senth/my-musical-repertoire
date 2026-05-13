# My Musical Repertoire — Implementation Plan

## Background & Context

This is a **piano/instrument practice app** that helps musicians decide what to practice. The core problem: "I often don't know what I should practice, and I want the app to help me pick."

### Key Decisions Made

- **Previous attempt**: Flutter — didn't like the developer experience
- **New stack**: Expo + React Native + NativeWind (Tailwind CSS) + Firebase + TypeScript
- **Why Expo over React + Vite + Capacitor**: Expo supports a web-first workflow (`npx expo start --web`) while providing true native mobile components. This avoids a costly migration later (60-70% UI rewrite) if we started with standard React web and later wanted native mobile.
- **Why Firebase**: Developer is already familiar with Firebase. Firebase offers excellent offline support (built-in Firestore offline persistence), real-time sync, and a mature ecosystem. The existing Flutter project already uses Firebase.
- **Development approach**: Solo developer with heavy Copilot/AI assistance

### App Requirements

- **Audience**: Existing pianists from roughly RCM Level 2 through professional level
- **Users**: Multi-user with accounts and authentication
- **Data**: Practice pieces, named technique items, sight-reading entries, exercise blocks, practice sessions, section targets, practice plans, and later PDF sheet music
- **Piece lifecycle**: Pieces move through **learning → stabilizing → maintenance**
- **Session domains**: Sessions should be able to include **technique**, **sight-reading**, and **repertoire** rather than only piece practice
- **Recommendation shape**: The app should generate a short, time-bounded **session plan** made of concrete exercise blocks, not only a ranked piece list
- **Session setup**: The student should choose available minutes and a session emphasis/template; the app should then fit the plan to the relevant duration band
- **Early recommendation scope**: Repertoire should be the first domain the app recommends intelligently; technique and sight-reading can stay template-driven and student-chosen at first
- **Per-block logging**: After each exercise block, the student should log **accuracy**, **tempo achieved** (when relevant), **effort/difficulty**, and **scope**; notes remain optional
- **Section granularity**: Practice can target the whole piece or an optional manual section label with optional bar ranges
- **Technique progression**: New technique items should be introduced manually by the student or teacher, while the app helps rotate and prioritize active items
- **Sight-reading UX**: Sight-reading should use lightweight logging so it stays fresh and non-perfectionist
- **Recommendation trust**: Each suggested block should briefly explain why it was chosen
- **Offline**: Must work offline (practicing without wifi) — Firestore's built-in offline persistence handles this
- **File uploads**: PDF/sheet music uploads to Firebase Cloud Storage
- **UI complexity**: Starts simple (lists, cards, buttons), grows to include timers, animations, and eventually PDF annotations
- **Mobile look**: Should look like a native iOS/Android app (platform conventions)
- **Push notifications**: Not needed
- **App store**: Maybe eventually (Android first, iOS later)
- **Platform**: Android primarily (developer's device), web-first for development

## Tech Stack

| Layer                | Technology                          | Why                                                      |
| -------------------- | ----------------------------------- | -------------------------------------------------------- |
| **Framework**        | React Native (via Expo SDK 55+)     | Universal: web + iOS + Android                           |
| **Routing**          | Expo Router v4+                     | File-based, works on web and mobile                      |
| **Styling**          | NativeWind (Tailwind CSS)           | Same Tailwind utility classes                            |
| **UI Components**    | React Native Paper or Tamagui       | Cross-platform native-feeling UI                         |
| **State management** | TanStack Query + Zustand            | Server state + client state                              |
| **Auth**             | Firebase Authentication             | Email + social login, familiar API                       |
| **Database**         | Cloud Firestore                     | NoSQL with built-in offline persistence & real-time sync |
| **File storage**     | Firebase Cloud Storage              | PDF/sheet music uploads                                  |
| **Build/deploy**     | EAS Build + EAS Submit              | Cloud builds for iOS/Android                             |
| **Testing**          | Jest + React Native Testing Library | Expo's default test setup                                |
| **Language**         | TypeScript                          | Type safety, better AI completions                       |

## Web-First Development Workflow

Expo fully supports developing and testing entirely in the browser:

1. Run `npx expo start --web` — app opens in your browser
2. Develop, debug, and test entirely in the browser
3. Use Chrome DevTools, React DevTools — just like standard React web dev
4. File-based routing (`app/` directory) works identically on web and mobile
5. When ready for mobile: press `a` for Android emulator or scan QR code with Expo Go
6. Platform-specific code uses `Component.web.tsx` / `Component.native.tsx` file splits

**You don't need an Android emulator or phone until Phase 6 (Mobile Polish).**

### React Native Cheat Sheet (for web React devs)

| Web (HTML)         | React Native   | Notes                        |
| ------------------ | -------------- | ---------------------------- |
| `<div>`            | `<View>`       | Generic container            |
| `<p>`, `<span>`    | `<Text>`       | All text must be in `<Text>` |
| `<button>`         | `<Pressable>`  | Touchable element            |
| `<input>`          | `<TextInput>`  | Text input field             |
| `<img>`            | `<Image>`      | Image component              |
| scrollable `<div>` | `<ScrollView>` | Scrollable container         |
| virtualized list   | `<FlatList>`   | For long lists (performant)  |

Tailwind classes are the same via NativeWind: `<View className="flex-1 p-4 bg-white">`.

## Implementation Phases

### Phase 1: Project Setup & Auth

- [x] Scaffold Expo project with Expo Router + TypeScript
- [x] Configure NativeWind (Tailwind CSS)
- [x] Set up Firebase project (auth, Firestore, storage)
- [x] Implement login/signup (email + social via Firebase Auth)
- [x] Basic layout shell (tabs, header) — test on web only

### Phase 2: Core Practice Catalog

- [x] Design Firestore data model (collections: pieces)
- [x] Set up Firestore security rules
- [x] Build CRUD UI for managing practice pieces
  - [x] Create piece (add-piece screen)
  - [x] Read / list pieces (pieces screen + overview)
  - [x] Edit piece (title, composer)
  - [x] Delete piece
- [x] Add piece lifecycle state (`learning`, `stabilizing`, `maintenance`)
- [x] Add named technique item model
  - [x] Technique item title (for example `Hanon No. 1`, `D major scale`, `A minor arpeggio`)
  - [x] Technique lifecycle / state (`active`, `maintenance`, `retired`)
  - [x] Student or teacher manually introduces new technique items
  - [ ] Add suggested techniques in the overview page (displayed similarly to suggested practices)
- [ ] Add optional priorities / goals that can influence recommendations
- [ ] Enable Firestore offline persistence
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 3: Practice Task Model & Logging

- [ ] Define reusable exercise block model
  - [ ] Session domain (`technique`, `sight-reading`, `repertoire`)
  - [ ] Repertoire focus category (`accuracy`, `rhythm`, `fingering`, `memory`, `tempo`, `tone`, `continuity`)
  - [ ] Scope (`whole piece` or `section`) for repertoire blocks
  - [ ] Optional section label + optional bar range
  - [ ] Optional target BPM for tempo-relevant blocks
  - [ ] Suggested duration
- [ ] Per-block logging
  - [x] Log practice date
  - [ ] Repertoire: accuracy result
  - [ ] Repertoire: tempo achieved
  - [ ] Repertoire: effort / perceived difficulty
  - [ ] Repertoire: scope completed
  - [ ] Technique: completion + confidence/difficulty trend
  - [ ] Technique: optional tempo/BPM when relevant
  - [ ] Sight-reading: material label + completion + perceived difficulty/confidence
  - [ ] Notes field (free text, optional)
- [ ] Before/after comparison after saving
  - [x] Comparison screen component
- [ ] Practice history screen
  - [ ] Whole-piece history
  - [ ] Section history for targeted work
  - [ ] Technique-item history
  - [ ] Sight-reading history
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 4: Session Plan Generator

- [ ] Ask the student how much time is available before building the plan
- [ ] Let the student choose a session emphasis/template
  - [ ] Short-session templates: `technique-first`, `reading-first`, `repertoire-only maintenance`
  - [ ] Medium and long-session templates with editable minutes per block
- [ ] Use duration bands so block structure changes for short, medium, and long sessions
- [ ] Generate a short session plan of concrete exercise blocks
  - [ ] Short sessions: one supporting block (`technique` or `sight-reading`) plus the main repertoire block
  - [ ] Repertoire blocks: at least one `learning`, weak-spot repair, or `maintenance` / continuity block when applicable
  - [ ] Longer sessions should add depth before adding too much variety
  - [ ] Repertoire is app-assigned first; technique and sight-reading remain template-driven initially
- [ ] Explain why each suggested block was chosen
- [ ] Replace the current simple overview sort with plan-based suggestions
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 5: Recommendation Engine Refinement

- [ ] Recommendation logic should weigh:
  - [ ] Piece lifecycle state
  - [ ] Time since last practice
  - [ ] Accuracy instability
  - [ ] Missed tempo targets
  - [ ] User priorities and goals
- [ ] Tune block sequencing so sessions are balanced instead of reactive
- [ ] Add technique-item prioritization
  - [ ] Time since last technique practice
  - [ ] Confidence / difficulty trend
  - [ ] `active` vs `maintenance` state
- [ ] Keep technique curriculum advancement manual at first; later the app may suggest when a new item is due
- [ ] Dashboard with practice overview, suggested blocks, and rationale
- [ ] Optional timer that executes a planned block rather than driving the data model
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 6: Sheet Music & Offline Polish

- [ ] PDF upload and viewing for sheet music (Firebase Cloud Storage)
  - [ ] Upload PDF to Cloud Storage
  - [ ] View PDF in-app
- [ ] Keep section definitions independent from PDFs
- [ ] Verify Firestore offline persistence works across all features
- [ ] Cache PDFs locally for offline sheet music viewing
- [ ] Handle edge cases (conflict resolution, stale data indicators)
- [ ] Offline-first UX patterns (optimistic updates, sync indicators)
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 7: Mobile Polish

- [ ] Test on Android device/emulator
- [ ] Platform-specific UI tweaks (`.native.tsx` overrides where needed)
- [ ] EAS Build for Android APK/AAB
- [ ] Optional Google Play Store publish
- [ ] Touch up UI/UX and fix any discrepancies

### Phase 8: Advanced Features (Future)

- [ ] PDF annotation support
- [ ] Practice reminders/scheduling
- [ ] Progress tracking with charts
- [ ] iOS support via EAS Build
- [ ] Teacher-authored priorities or assignments layered on top of the student-first model
- [ ] Touch up UI/UX and fix any discrepancies

## Architecture Notes

- **Firestore offline persistence**: Firestore has built-in offline support — data is cached locally and synced automatically when connectivity returns. This is a major advantage over manual sync solutions.
- **Pedagogy first**: Recommendation quality depends more on good task modeling, lifecycle states, and logging than on PDFs or timers. Build the teaching model before the document model.
- **Session plans, not just lists**: The app should behave more like a practice coach, giving a short sequence of blocks that fits the student's available time.
- **Two planning layers**: The app should first shape the session template (`technique`, `sight-reading`, `repertoire`, and minutes per block), then decide the exact assignment inside repertoire blocks.
- **Duration bands with ceilings on variety**: Longer sessions should usually deepen work rather than create endless switching. Short sessions should use one supporting slot plus the main repertoire block.
- **Staged intelligence**: Repertoire should be the first domain the app recommends intelligently. Technique and sight-reading can stay student-chosen within templates until the product is mature enough for broader recommendation logic.
- **Technique is a small curriculum**: New scales, arpeggios, or Hanon items should be introduced manually by the student or teacher at first. The app's early job is rotation and prioritization among active items, not autonomous curriculum design.
- **Sight-reading should stay light**: Logging should be intentionally minimal so sight-reading remains fresh, low-pressure, and distinct from repertoire polishing.
- **Section model before score model**: Manual section labels and optional bar ranges should exist before any PDF parsing or annotation work. Targeted practice cannot depend on sheet-music features shipping first.
- **Incremental complexity**: Start with simple lists and cards. Add timers, PDF features, and advanced visual polish only after the recommendation engine has enough high-quality inputs.
- **Platform splits**: When mobile needs differ from web, use `Component.web.tsx` / `Component.native.tsx` — Expo auto-picks the right one.
- **Existing Flutter code**: This repo contains a previous Flutter implementation. The Expo rewrite will replace it entirely. Reference the existing code for feature/data model inspiration.
- **Firebase project**: This repo already has Firebase config (`.firebaserc`, `firebase.json`, `firestore.rules`). Reuse the existing Firebase project and Firestore rules as a starting point.
