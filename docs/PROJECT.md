# My Musical Repertoire — Project Reference

> Vision, requirements, key decisions, and architecture principles.
> **Tasks live in GitHub Issues + the Kanban board, not here** (see [TODO.md](../TODO.md)).
> Per-feature deep specs live in [`docs/specs/`](specs/).

## Background & Context

A **piano/instrument practice app** that helps musicians decide what to practice.
The core problem: _"I often don't know what I should practice, and I want the app to help me pick."_

### Key Decisions

- **Previous attempt**: Flutter — disliked the developer experience.
- **New stack**: Expo + React Native + NativeWind (Tailwind CSS) + Firebase + TypeScript.
- **Why Expo over React + Vite + Capacitor**: Expo supports a web-first workflow
  (`npx expo start --web`) while providing true native mobile components. Avoids a
  costly migration later (60–70% UI rewrite) versus starting with standard React web.
- **Why Firebase**: Already familiar to the developer. Excellent offline support
  (built-in Firestore offline persistence), real-time sync, mature ecosystem. The
  previous Flutter project already used Firebase.
- **Development approach**: Solo developer with heavy Copilot/AI assistance.

## App Requirements

- **Audience**: Existing pianists from roughly RCM Level 2 through professional level.
- **Users**: Multi-user with accounts and authentication.
- **Data**: Practice pieces, named technique items, sight-reading entries, exercise
  blocks, practice sessions, section targets, practice plans, and later PDF sheet music.
- **Piece lifecycle**: Pieces move through **learning → stabilizing → maintenance**.
- **Session domains**: Sessions can include **technique**, **sight-reading**, and
  **repertoire** — not only piece practice.
- **Recommendation shape**: Generate a short, time-bounded **session plan** of concrete
  exercise blocks, not only a ranked piece list.
- **Session setup**: The student chooses available minutes and a session emphasis/template;
  the app fits the plan to the relevant duration band.
- **Early recommendation scope**: Repertoire is the first domain recommended intelligently;
  technique and sight-reading stay template-driven and student-chosen at first.
- **Per-block logging**: After each block, log **accuracy**, **tempo achieved** (when
  relevant), **effort/difficulty**, and **scope**; notes remain optional.
- **Section granularity**: Practice can target the whole piece or an optional manual
  section label with optional bar ranges.
- **Technique progression**: New technique items are introduced manually by the
  student/teacher; the app helps rotate and prioritize active items.
- **Sight-reading UX**: Lightweight logging so it stays fresh and non-perfectionist.
- **Recommendation trust**: Each suggested block briefly explains why it was chosen.
- **Offline**: Must work offline (practicing without wifi) — Firestore's built-in offline
  persistence handles this.
- **File uploads**: PDF/sheet music uploads to Firebase Cloud Storage.
- **UI complexity**: Starts simple (lists, cards, buttons); grows to timers, animations,
  and eventually PDF annotations.
- **Mobile look**: Should look like a native iOS/Android app (platform conventions).
- **Push notifications**: Not needed.
- **App store**: Maybe eventually (Android first, iOS later).
- **Platform**: Android primarily (developer's device), web-first for development.

## Architecture Principles

- **Firestore offline persistence**: Built-in offline support — data is cached locally and
  synced automatically when connectivity returns. A major advantage over manual sync.
- **Pedagogy first**: Recommendation quality depends more on good task modeling, lifecycle
  states, and logging than on PDFs or timers. Build the teaching model before the document model.
- **Session plans, not just lists**: The app behaves like a practice coach, giving a short
  sequence of blocks that fits the student's available time.
- **Two planning layers**: First shape the session template (`technique`, `sight-reading`,
  `repertoire`, and minutes per block), then decide the exact assignment inside repertoire blocks.
- **Duration bands with ceilings on variety**: Longer sessions deepen work rather than create
  endless switching. Short sessions use one supporting slot plus the main repertoire block.
- **Staged intelligence**: Repertoire is the first domain recommended intelligently. Technique
  and sight-reading stay student-chosen within templates until the product matures.
- **Technique is a small curriculum**: New scales, arpeggios, or Hanon items are introduced
  manually at first. The app's early job is rotation and prioritization among active items,
  not autonomous curriculum design.
- **Sight-reading stays light**: Logging is intentionally minimal so sight-reading remains
  fresh, low-pressure, and distinct from repertoire polishing.
- **Section model before score model**: Manual section labels and optional bar ranges exist
  before any PDF parsing or annotation. Targeted practice cannot depend on sheet-music features.
- **Sections are piece-level, not block-level**: Sections (label + optional bar range + phase +
  current BPM) live on the piece and are referenced by practice blocks. This enables per-section
  history, BPM-bump suggestions, and chaining. Blocks never define ad-hoc sections.
- **Section progression is student-gated**: The student decides when to add the next section.
  The app nudges but never gates or auto-unlocks. BPM increments are suggested (not automatic)
  based on accuracy + effort + cross-day consistency. Section chaining (A → B → A+B with a seam
  exercise) is the engine's most important structural suggestion.
- **Incremental complexity**: Start with simple lists and cards. Add timers, PDF features, and
  advanced visual polish only after the recommendation engine has enough high-quality inputs.
- **Platform splits**: When mobile needs differ from web, use `Component.web.tsx` /
  `Component.native.tsx` — Expo auto-picks the right one.
- **Existing Flutter code**: This repo contains a previous Flutter implementation that the Expo
  rewrite replaces entirely. Reference it for feature/data-model inspiration.
- **Firebase project**: Reuse the existing Firebase config (`.firebaserc`, `firebase.json`,
  `firestore.rules`) and Firestore rules as a starting point.

## Where Things Live

| Concern | Home |
| --- | --- |
| Actionable tasks (bugs, features, ideas, cleanup) | GitHub Issues + Kanban board |
| Prioritized "what's next" mirror | [`TODO.md`](../TODO.md) (generated) |
| Per-feature deep specs | [`docs/specs/`](specs/) |
| Tech stack, setup, web-first workflow, RN cheat sheet | [`README.md`](../README.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Vision, requirements, decisions, architecture | this file |
| Agent coding rules | [`.github/copilot-instructions.md`](../.github/copilot-instructions.md), `.claude/CLAUDE.md` |
