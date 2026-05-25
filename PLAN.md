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
- [x] Add section model to pieces (piece-level, reused across all practice sessions)
  - [x] Section label (required) + optional bar range (start bar, end bar)
  - [x] Section lifecycle/phase (`learning`, `stabilizing`, `maintenance`) — independent of piece phase
  - [x] Current BPM per section (student-set highest reliable/comfortable working BPM; not auto-updated from logs)
  - [x] Optional target BPM override per section (inherits piece's target BPM by default)
  - [x] Optional notes/problem field per section (e.g. "LH leaps", "memory insecure")
  - [x] Soft delete (archived flag) — preserves practice history references
  - [x] CRUD UI for sections within a piece (add, reorder via drag-and-drop, edit, archive)
- [x] Add named technique item model
  - [x] Technique item title (for example `Hanon No. 1`, `D major scale`, `A minor arpeggio`)
  - [x] Technique lifecycle / state (`active`, `maintenance`, `retired`)
  - [x] Student or teacher manually introduces new technique items
  - [x] Add suggested techniques in the overview page (displayed similarly to suggested practices)
- [x] Create GH Action and deploy to Google Storage for hosting the web version
- [x] Touch up UI/UX and fix any discrepancies
  - [x] **Section Form & Edit Page**
    - [x] Add section/edit section should be a new page for mobile instead of a modal/dialog — routed as `/pieces/{id}/section/{id}/edit`. This also resolves ISSUE-008 and ISSUE-011. ([ISSUE-008](/.tmp/ui-ux-issues.md), [ISSUE-011](/.tmp/ui-ux-issues.md))
    - [x] Remove target BPM override from the section edit screen. It should be using the piece-level target BPM for all sections.
    - [x] The bars sections should be Bars [start] - [end] instead of Start bar [input]. If end bar is set, start bar also needs to be set. Otherwise both are optional.
    - [x] Fix stale form values: reset `SectionFormModal` state when `visible` becomes `true` or `initialValues` changes ([ISSUE-010](/.tmp/ui-ux-issues.md))
  - [x] **Navigation & Routing**
    - [x] Change routes for practices. It should be /techniques/{id}/practice and /pieces/{id}/practice. However, in Firestore, they should still be in the same collection as it's currently. So no DB changes.
    - [x] Fix post-practice navigation: "Back to Overview" must navigate explicitly to `/(app)/(tabs)/overview` ([ISSUE-012](/.tmp/ui-ux-issues.md))
    - [x] Fix post-technique-log navigation: navigate explicitly to `/(app)/(tabs)/techniques` instead of `router.back()` ([ISSUE-013](/.tmp/ui-ux-issues.md))
    - [x] Practice and technique-log app bars: show piece/technique name as the title ([ISSUE-015](/.tmp/ui-ux-issues.md))
  - [x] **List Screen Enhancements**
    - [x] Add tab for Pieces — add FAB on Pieces screen to match Overview/Techniques ([ISSUE-007](/.tmp/ui-ux-issues.md))
    - [x] Create a `StateFilterChips` reusable component; refactor Pieces screen to use it; add pill filter to Techniques screen (All | Active | Maintenance | Retired)
    - [x] Techniques screen: add `Searchbar` using the same pattern as Pieces (reuse existing `screen.techniques.searchPlaceholder` key) ([ISSUE-022](/.tmp/ui-ux-issues.md))
    - [x] Standardize primary tap action: tap = detail everywhere; expose Practice as a clearly labeled secondary action across Overview cards, Pieces rows, and Techniques rows ([ISSUE-002](/.tmp/ui-ux-issues.md)); created technique detail screen (`/technique/[id]/index.tsx`)
    - [x] Fix techniques compact-row menu anchor so popup appears next to the pressed button ([ISSUE-003](/.tmp/ui-ux-issues.md))
  - [x] **Empty States & Loading Guards**
    - [x] Overview: keep page scaffold visible when there are no pieces; show inline empty state only inside the Pieces section; always render the Techniques section ([ISSUE-001](/.tmp/ui-ux-issues.md))
    - [x] Techniques: differentiate "no techniques exist" from "all are hidden by retired filter"; show contextual "Show retired" CTA ([ISSUE-006](/.tmp/ui-ux-issues.md))
    - [x] Pieces and Techniques list screens: show loading indicator while Firestore resolves; gate empty states behind `!loading` ([ISSUE-004](/.tmp/ui-ux-issues.md))
    - [x] Detail/edit/practice screens: add loading guards so "not found" only renders after loading completes ([ISSUE-005](/.tmp/ui-ux-issues.md))
  - [x] **Practice Screen**
    - [x] Convert the practice radio buttons to be similar as technique practice page.
    - [x] Replace section admin link during practice with a lightweight read-only section picker sheet ([ISSUE-009](/.tmp/ui-ux-issues.md))
    - [x] Technique comparison: use composite verdict (quality + effort + tempo) instead of quality-only ([ISSUE-014](/.tmp/ui-ux-issues.md))
    - [x] For the BPM input on the practice screen, prefill it from the previous session, for any practice session.
  - [x] **Form Validation**
    - [x] Inline field validation across all forms: mark invalid `TextInput`s with `error` prop + helper text ([ISSUE-016](/.tmp/ui-ux-issues.md))
    - [x] Numeric BPM inputs: validate explicitly and show inline error on bad input ([ISSUE-017](/.tmp/ui-ux-issues.md))
    - [x] Surface Google sign-in errors to the user (snackbar/inline message, same pattern as email/password) ([ISSUE-019](/.tmp/ui-ux-issues.md))
  - [x] **Global Polish**
    - [x] Can't scroll on any of the pages.
    - [x] FAB positioning: apply safe-area insets and tab-bar-aware bottom spacing to all FABs ([ISSUE-021](/.tmp/ui-ux-issues.md))
    - [x] i18n: add `common.ok` translation key and replace all hardcoded `"OK"` snackbar labels ([ISSUE-020](/.tmp/ui-ux-issues.md))
    - [x] Accessibility: add localized `accessibilityLabel`/`accessibilityHint` to all icon-only actions (FABs, dots menus, drag handles, edit/delete buttons) ([ISSUE-018](/.tmp/ui-ux-issues.md))
  - [x] **Misc**
    - [x] Overview header and bottom tabs have light background instead of dark.
    - [x] FAB in overview should allow user to select "Add piece" or "Add technique" instead of going directly to add-piece screen.
    - [x] My repertoire tab/page should be renamed to "Pieces" to match the tab label and avoid confusion with the whole app's name.
    - [x] Double "heading" on My Repertoire and Techniues detail pages.
    - [x] Missing padding for Search and filter row on my repertoire and techniques list pages.
    - [x] Filters should be presented as chips menu dropdown instead of inline pills to save vertical space. If "All/None" is selected it should instead show "Lifecycle" for example.
    - [x] Lots of space between the pill filter and the actual list. Seems like the list is vertically centered instead of a top-aligned list with a header. This is especially noticeable on the techniques page when there are few items.
    - [x] On web, both desktop and mobile we can't scroll.
    - [x] On web, FAB is not shown until you scroll down to the bottom of the page (which currently is not possible).
  - [ ] **Bugs**
    - [x] When practicing is done, we should return to the original page. So if we start pracicing from Overview, we should return from there (likewise if we first enter from the overview and go into the piece and then start practire). If we enter from pieces, we should go back to pieces after practice. Same goes with techniques.
    - [x] When pressing new practice or technique on web. The title focuses but then blurs immediately, which shows an error.
    - [x] Can't scroll on web on Overview, Pieces, or Technique pages, and probably sections as well.
    - [x] FAB button is not in the correct place (absolute positioned) and goes off screen when Overview, Pieces, or Technique pages have many items.
    - [x] FAB button is not in the correct place and not in the same location across pages. (Too far up). Check MD3 guidelines for FAB placement.
    - [x] Filter chip is stretched out over the whole row. I don't think this is how it's supposed to be according to MD3.
  - [x] **Improvements**
    - [x] In practice screen, the BPM input should be pre-filled with the previous session's BPM (lastAchievedTempoBpm) for that piece/section/technique.
    - [x] When BPM has been set in the practice input field, add toggle Metronome on/off that plays a click track at the set BPM.

### Phase 3: Practice Task Model & Logging

- [x] Piece Practice redesign:
  - [x] Remove date field (should always log with the current date)
  - [x] Sections should be displayed at bottom (between Memory mistakes and Save button)
    - [x] Display all sections in a compact list with label + progress line (current BPM vs target BPM) + Practice button for each section.
    - [x] When practing the full piece, but having mistakes it would be good to select specific sections that were problematic to focus on those. Unsure how to present this in the UI in a good way.
- [x] Piece section redesign:
  - [x] Consult a UI/UX designer for this one, but also the piano teacher agent can provide input on what information is most important to show (and show be in focus). Make sure it looks good when piece has target bpm and section has working bpm set (see Terra's theme piece for example)
  - [x] Manage & reorder sections can be removed.
  - [x] Add small "Practice" button for each section.
  - [x] Left/Right padding missing
  - [x] Not all fields are shown.
- [ ] Define reusable exercise block model
  - [ ] Session domain (`technique`, `sight-reading`, `repertoire`)
  - [ ] Repertoire focus category (`accuracy`, `rhythm`, `fingering`, `memory`, `tempo`, `tone`, `continuity`)
  - [ ] Scope (`whole piece` or `section`) for repertoire blocks
  - [ ] Reference to piece-level section when scope is `section` (not ad-hoc — use the piece's defined sections)
  - [ ] Optional target BPM for tempo-relevant blocks (defaults to section's current BPM)
  - [ ] Suggested duration
- [ ] Per-block logging
  - [x] Log practice date
  - [ ] Pieces: accuracy result
  - [ ] Pieces: tempo achieved (BPM practiced at, updates section's current BPM)
  - [ ] Pieces: effort / perceived difficulty
  - [ ] Pieces: scope completed
  - [ ] Piece sections
  - [ ] Technique: completion + confidence/difficulty trend
  - [ ] Technique: optional tempo/BPM when relevant
  - [ ] Notes field (free text, optional)
  - [ ] Sight-reading: material label + completion + perceived difficulty/confidence
- [ ] Before/after comparison after saving
  - [x] Comparison screen component
- [ ] Practice history screen
  - [ ] Whole-piece history
  - [ ] Section history for targeted work
  - [ ] Technique-item history
  - [ ] Sight-reading history
- [ ] Enable Firestore offline persistence
- [ ] Touch up UI/UX and fix any discrepancies
  - [x] Piece practice page should show the bars, and target BPM.
  - [x] Metronome gain should be even higher.
  - [ ] Autocomplete Composer field when creating/editing
  - [ ] Add Piece Album/Collection field (optional) and autocomplete it as well
  - [ ] Status filter on pieces/techniques should not show "Status" in the menu. Instead It would be good to have these as checkboxes so that you can select multiple at the same time. By default none is selected and is using default filtering.
  - [ ] Reset password not centered on the page
  - [ ] Chips are too visual. They are visually bold and overwhelming making them the center of attention. Whereas they should only be complementary, but still be visually distinct enough to be easily scannable.
  - [ ] Paddings on each page (ask md3-designer to check for padding/margins consistency and adherence to guidelines)
  - [ ] Some pages span whole width of the screen on desktop web, when they should be centered with a max width (like other pages).
  - [ ] Some self-estimation bars uses numbers, some text. We should be consistent. Ideally the "best" should be at the same location (to the right). For examlp effort should be low, but it's on the left side. I think it's better to have text than numbers. However, we need to make sure that works even when the text doesn't fit (should maybe be smaller text so always fits?)
  - [x] Always show metronome button, but should be disabled when BPM is not set.
  - [ ] When adding piece, section, or technique. Title is focused on web, but immediately blurred. Try to fix with playwright.

### Phase 4: Session Plan Generator

- [ ] Session plan is section-aware
  - [ ] Prioritize weak/unstable sections first (need-based ordering, not bar order)
  - [ ] Limit new-section (`learning` phase) blocks to 1 per session
  - [ ] When two adjacent sections are individually stable, suggest a **seam exercise** (last 2 bars of A + first 2 bars of B)
  - [ ] After seam is practiced, suggest a **join block** (A+B combined)
  - [ ] Nudge the student when sections look stable enough to add the next section (student still decides)
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
    - [ ] ? Add `priority` flag (`normal` | `high`) to pieces
    - [ ] ? Add optional `deadlineDate` to pieces
- [ ] Tune block sequencing so sessions are balanced instead of reactive
- [ ] Add technique-item prioritization
  - [ ] Time since last technique practice
  - [ ] Confidence / difficulty trend
  - [ ] `active` vs `maintenance` state
- [ ] Section BPM progression
  - [ ] Suggest a BPM bump (~+4 BPM) when accuracy is high, effort is manageable, and the same BPM was successful on 2+ separate days
  - [ ] User confirms or dismisses each suggestion; no automatic increment
- [ ] Section progression nudges
  - [ ] Suggest phase transitions: `learning` → `stabilizing` → `maintenance` based on practice history
  - [ ] Suggest "you look ready to add the next section" when active sections are stable
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

## Ideas

- Metronome: time signature selector (4/4, 3/4, 6/8, 2/4) with beat-1 accent
- Metronome: tap tempo input (tap 4–8 beats → computed BPM)
- Metronome: volume / mute control
- Metronome: visual beat pulse animation
- Metronome: native Android audio via `expo-av` (replace current native no-op stub)

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
- **Sections are piece-level, not block-level**: Sections (label + optional bar range + phase + current BPM) live on the piece and are referenced by practice blocks. This lets the app track per-section history, suggest BPM bumps, and recommend chaining. Blocks never define ad-hoc sections — they reference the piece's defined sections.
- **Section progression is student-gated**: The student decides when to add the next section. The app nudges but never gates or auto-unlocks. BPM increments are suggested (not automatic) based on accuracy + effort + cross-day consistency. Section chaining (A → B → A+B with seam exercise) is the engine's most important structural suggestion.
- **Incremental complexity**: Start with simple lists and cards. Add timers, PDF features, and advanced visual polish only after the recommendation engine has enough high-quality inputs.
- **Platform splits**: When mobile needs differ from web, use `Component.web.tsx` / `Component.native.tsx` — Expo auto-picks the right one.
- **Existing Flutter code**: This repo contains a previous Flutter implementation. The Expo rewrite will replace it entirely. Reference the existing code for feature/data model inspiration.
- **Firebase project**: This repo already has Firebase config (`.firebaserc`, `firebase.json`, `firestore.rules`). Reuse the existing Firebase project and Firestore rules as a starting point.
