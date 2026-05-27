# Spec: Practice Session Generator

## Phase 0: Handoff

**Spec file:** `docs/specs/session-generator.md`

**Implementer instructions:**
- Use the Phases section (Phase 1–7) as the implementation plan. No separate PLAN.md needed.
- After all phases verified working, check off this PLAN.md item:
  - `- [ ] Define reusable exercise block model` (and all its sub-bullets) under **Phase 3: Practice Task Model & Logging** — replaced by this session generator scope.
- This spec **reframes** the original "reusable exercise block model" item. The rich template/focus-category schema is dropped; the session generator delivers the user-visible value. Note this in the PLAN.md checkmark commit message.
- Run `yarn lint` after each phase. Fix all issues including pre-existing.
- Manually test via Playwright (login: senth.wallace@gmail.com / hellomynameispassword123, local server at http://localhost:8081).
- Never commit — user reviews and commits manually.
- Respond in caveman ultra.
- Use Serena/Repowise MCP tools over Explore subagents for code investigation (per existing user feedback).

## 1. What

A session generator + coach for practice. The student picks an emphasis (Balanced / Technique-heavy / Reading-heavy / Repertoire-only), confirms available minutes and which domains are active, then the app generates a structured session — a sequence of blocks (warmup, technique, sight-reading, repertoire sub-blocks for learning / stabilizing / maintenance) with allocated minutes. The app guides the student block-by-block in **coach mode**: existing piece/technique practice screens are wrapped with dual progress bars (session + block) and a "Save & next" flow. Sessions are ephemeral; an active session can be resumed if the app is closed mid-flow.

This spec REFRAMES PLAN.md's "Define reusable exercise block model" item. The original block-template schema is dropped; instead, blocks exist as runtime instances of the generated session. The session generator delivers the user-visible value the block model was scaffolding for.

## 2. Why

The student's stated need: "I had 30 minutes. How should I structure it?" The app already has lifecycle states, sections, BPM tracking, and per-piece/technique logging. What it lacks is automated session structure. Building a thin vertical slice (allocate → guide → log) delivers value now and gives the future recommendation engine (Phase 5) real session-shape signals.

## 3. Data Model

### New: SessionEmphasis enum

```typescript
// models/session.ts (new)
export type SessionEmphasis =
  | "balanced"
  | "technique-heavy"
  | "reading-heavy"
  | "repertoire-only";

export type BlockKind =
  | "warmup"
  | "technique"
  | "sight-reading"
  | "repertoire-learning"
  | "repertoire-stabilizing"
  | "repertoire-maintenance";

export interface PlannedBlock {
  kind: BlockKind;
  allocatedMinutes: number;
  // Target reference, populated by the planner. Exactly one ref set per block.
  pieceId?: string | null;
  sectionId?: string | null;   // only for repertoire-learning / repertoire-stabilizing
  techniqueId?: string | null; // for technique + warmup
  // Display metadata (denormalized for the coach UI; pulled fresh each generate)
  title?: string | null;
  subtitle?: string | null;
  // Score the planner computed (for debugging / explanation)
  score?: number | null;
  rationale?: string | null;
}

export interface SessionPlan {
  emphasis: SessionEmphasis;
  totalMinutes: number;
  blocks: PlannedBlock[];
  generatedAt: string; // ISO timestamp
}

export interface SessionInputs {
  totalMinutes: number;
  emphasis: SessionEmphasis;
  techniqueEnabled: boolean;
  sightReadingEnabled: boolean;
  // repertoire always enabled (cannot be unchecked)
}

export interface BlockExecutionState {
  index: number;
  status: "pending" | "in-progress" | "completed" | "skipped";
  elapsedSeconds: number;       // accumulates across pause/resume
  extendMinutes: number;        // total minutes added via "Extend"
}

export interface ActiveSession {
  plan: SessionPlan;
  inputs: SessionInputs;
  startedAt: string;            // ISO
  currentBlockIndex: number;
  blockStates: BlockExecutionState[];
  sessionElapsedSeconds: number;
}
```

### Persisted locally (AsyncStorage)

**New dependency:** `@react-native-async-storage/async-storage` (add to package.json).

Storage keys (per-user namespaced via auth UID):

| Key | Value | Purpose |
|---|---|---|
| `session-inputs:{uid}:{emphasis}` | `SessionInputs` | Last-used minutes + checkboxes per emphasis |
| `active-session:{uid}` | `ActiveSession` | In-flight session for resume |

No Firestore changes for the session entity itself. Sessions are ephemeral.

### Firestore: existing collections reused

- `PiecePractice` writes via existing `useSavePractice` hook (repertoire blocks). Add `triggeredFrom: 'session-coach'` value to the existing `PracticeTrigger` enum.
- Technique logs via existing `useSaveTechniqueLog` (technique + warmup blocks).
- Sight-reading blocks: **no log written** for MVP. Coach just runs the timer.

### Model file additions

```typescript
// models/practice.ts — extend
export type PracticeTrigger =
  | "full-piece"
  | "section-panel"
  | "direct"
  | "session-coach";   // new
```

## 4. UI Flow

### 4.1 Overview screen — new "New Practice Session" section

Inserted at the **top** of Overview (above Pieces section), four list items with a play icon:

```
New Practice Session
────────────────────────────────────────────
▶ Balanced focus
▶ Technique focused
▶ Reading focused
▶ Repertoire focused
```

Tapping a row navigates to the setup screen `/session/setup?emphasis={emphasis}`.

If an active session exists in AsyncStorage, this section is **replaced** by a single resume banner:

```
🎵 Session in progress — Balanced, 30 min
   Block 3 of 5: Beethoven Op.27 (Bridge)
   [Resume]   [End]
```

Tap Resume → coach screen. Tap End → clear active session.

### 4.2 Setup screen `/session/setup`

Inputs (loaded from `session-inputs:{uid}:{emphasis}`, else defaults):

| Field | Default | UI |
|---|---|---|
| Total minutes | 30 | Slider 15–90 (5-min step) + numeric badge |
| Include technique | true | Switch |
| Include sight-reading | true | Switch |
| Emphasis | from route param | Read-only chip (link to change) |

Below inputs, a **live preview** of allocated minutes per block (the planner runs in preview mode):

```
Estimated plan
  • Technique          7 min
  • Sight-reading      4 min
  • Learning           10 min  (Beethoven Op.27 / Bridge)
  • Stabilizing        6 min   (Bach Invention 4)
  • Maintenance        3 min   (Chopin Prelude in E)
```

If a domain has no eligible content (e.g. no active techniques), preview shows the redistribution: `"No techniques available — added to repertoire"`.

Bottom: `[Start session]` button. On press: write the inputs to AsyncStorage, generate the final plan, write the active session, navigate to coach.

### 4.3 Coach screen `/session/coach`

Top of screen: **two slim progress bars** with elapsed/remaining labels.

```
┌─────────────────────────────────────────┐
│ Session         12:34          -17:26   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░       │
│                                          │
│ Block 3/5  Bridge (Beethoven Op.27)      │
│ ██████████████░░░░░░    4:12    -3:48   │
└─────────────────────────────────────────┘
```

- Top bar = total session elapsed / remaining (negative format like `-17:26`)
- Second bar = current block elapsed / remaining
- When a block timer hits 0: bar turns warning color + soft sound plays. No auto-advance. Negative remaining shown.

**Body** of the screen depends on block kind:

| BlockKind | Body content |
|---|---|
| `warmup` | Renders the **technique practice screen** (`technique/[id]/practice.tsx`) for the picked maintenance technique. If no maintenance techniques exist, renders a minimal screen: "Warmup — gentle scales of your choice" + timer + Done. |
| `technique` | Renders technique practice screen for the picked technique. |
| `sight-reading` | Minimal screen: title "Sight-reading", timer (handled by coach bars above), "Done" button. No material picker. No log. |
| `repertoire-learning` / `repertoire-stabilizing` | Renders piece practice screen (`piece/[id]/practice.tsx`) **with `sectionId` set**. |
| `repertoire-maintenance` | Renders piece practice screen **without sectionId** (whole piece). |

The practice screens are **wrapped** by a `<CoachShell>` component that:
1. Renders the dual progress bars at top
2. Replaces the screen's default Save button with `[Save & next block]`
3. Adds a toolbar with `[Skip]` and `[Extend +2 min]` buttons (icon-only with accessibility labels)
4. After save (or skip), advances `currentBlockIndex`, persists `ActiveSession` to AsyncStorage, transitions to next block. After the last block, navigates to summary.

When a block is in progress, the user can navigate back out of coach (e.g. tap a hardware back button). Timer continues counting elapsed time using a captured start timestamp; on resume the elapsed time reflects real wall-clock. (Implementation: store `currentBlockStartedAt` in `ActiveSession`; elapsedSeconds = now − startedAt for the active block, persisted on every save/skip.)

### 4.4 Summary screen `/session/summary`

Shown after the last block. Stats:

```
Session complete

Total practiced:  28 of 30 min
Blocks done:      4 of 5  (1 skipped)

What you practiced:
  ✓ Technique     7 min — Hanon No. 1
  ✓ Sight-reading 4 min
  ✓ Learning      10 min — Beethoven Op.27 / Bridge
  ⤬ Stabilizing  (skipped)
  ✓ Maintenance   3 min — Chopin Prelude in E

[Done]
```

Tap `[Done]` → clear active session from AsyncStorage → navigate to Overview.

### 4.5 What changes in existing practice screens

The existing piece practice screen + technique practice screen are **unchanged in standalone use.** When mounted under `<CoachShell>`, the shell injects:
- Pass-through props for `coachMode: true`, `onSaveNext: () => void`
- The Save button is replaced (visually identical, label says "Save & next block")
- Timer rendered above by the shell, not by the screens themselves

Implementation hint: do this by exposing a `coachOverrides` prop on the practice screens, or by lifting the Save button into the shell when `coachMode` is true. Avoid prop drilling: pass via React context (`CoachContext`).

## 5. Logging

| Block kind | Log written | Mechanism |
|---|---|---|
| `warmup` | TechniqueLog | Existing `useSaveTechniqueLog`, `triggeredFrom`-style field if added |
| `technique` | TechniqueLog | Existing `useSaveTechniqueLog` |
| `sight-reading` | None | No log (MVP) |
| `repertoire-learning` / `repertoire-stabilizing` | PiecePractice | Existing `useSavePractice`, `triggeredFrom: 'session-coach'`, `sectionId` set |
| `repertoire-maintenance` | PiecePractice | Existing `useSavePractice`, `triggeredFrom: 'session-coach'`, no sectionId |
| Skipped blocks | None | Tracked in `ActiveSession.blockStates` only; never written to Firestore |

## 6. Planner Logic (Reference)

### 6.1 Time allocation

Reference table by total minutes × emphasis. Linear interpolation between rows for non-reference durations. Below 15 → clamp to 15. Above 60 → extrapolate using 45→60 slope. Cap at 90.

| Total | Emphasis | Tech | Read | Rep | Warmup |
|---|---|---|---|---|---|
| 15 | Balanced | 3 | 2 | 10 | — |
| 15 | Tech-heavy | 6 | 0 | 9 | — |
| 15 | Reading-heavy | 2 | 4 | 9 | — |
| 15 | Repertoire-only | 0 | 0 | 15 | — |
| 30 | Balanced | 7 | 4 | 19 | — |
| 30 | Tech-heavy | 14 | 2 | 14 | — |
| 30 | Reading-heavy | 5 | 9 | 16 | — |
| 30 | Repertoire-only | 0 | 0 | 30 | — |
| 45 | Balanced | 10 | 6 | 29 | — |
| 45 | Tech-heavy | 20 | 3 | 22 | — |
| 45 | Reading-heavy | 7 | 13 | 25 | — |
| 45 | Repertoire-only | 0 | 0 | 45 | — |
| 60 | Balanced | 12 | 8 | 35 | 5 |
| 60 | Tech-heavy | 23 | 4 | 28 | 5 |
| 60 | Reading-heavy | 8 | 17 | 30 | 5 |
| 60 | Repertoire-only | 0 | 0 | 55 | 5 |

Warmup carved at **60+ min** only (subtract 5 min from total, then compute table, then prepend warmup).

### 6.2 Domain disabled redistribution

If `techniqueEnabled = false`: technique minutes → repertoire.
If `sightReadingEnabled = false`: sight-reading minutes → repertoire.
If both false → effectively becomes Repertoire-only at the allocation level (emphasis label retained for UI).

### 6.3 Repertoire sub-split

Within the repertoire allocation, split into learning / stabilizing / maintenance sub-blocks:

- Learning: 55%, Stabilizing: 30%, Maintenance: 15%
- If repertoire block < 12 min → drop maintenance (split goes 65% learning / 35% stabilizing)
- If repertoire block < 7 min → collapse to learning only (100%)
- If a state has zero pieces, redistribute proportionally to remaining states

### 6.4 Block order by emphasis

```
Balanced:        warmup? → technique → sight-reading → learning → stabilizing → maintenance
Tech-heavy:      warmup? → technique → learning → stabilizing → sight-reading → maintenance
Reading-heavy:   warmup? → sight-reading → technique → learning → stabilizing → maintenance
Repertoire-only: warmup? → learning → stabilizing → maintenance
```

Blocks with 0 allocated minutes (after redistribution + thresholds) are omitted.

### 6.5 Piece + section selection — score formulas

**For repertoire-learning slot** (piece.state = `learning`):

Build candidate pool: all sections from pieces with `state = learning`. If a piece has no sections, treat it as a single virtual section (phase = `learning`, lastPracticed = piece.lastPracticed, currentBpm = piece.lastAchievedTempoBpm).

```
score(section) = phaseScorePerDay × daysSinceLastPracticed
               + max(0, piece.targetTempoBpm − section.currentBpm)

phaseScorePerDay = 10 (section.phase = learning)
                 |  3 (section.phase = stabilizing)
                 |  1 (section.phase = maintenance)

daysSinceLastPracticed = 999 if section.lastPracticed is null
                       | (now − section.lastPracticed) in whole days

BPM term:
  = 0 if piece.targetTempoBpm is null OR section.currentBpm is null
  = max(0, piece.targetTempoBpm − section.currentBpm) otherwise
```

Highest score wins. Tie-break: `piece.createdAt` ASC, then `piece.title` ASC, then `section.order` ASC.

**For repertoire-stabilizing slot** (piece.state = `stabilizing`):

Same formula and pool construction but filtered to `state = stabilizing` pieces.

**For repertoire-maintenance slot** (piece.state ∈ {`maintenance`, `performance`}):

Skip section drill. Pool = pieces with `state ∈ {maintenance, performance}`.

```
score(piece) = daysSinceLastPracticed × stateWeight
             + max(0, piece.targetTempoBpm − piece.lastAchievedTempoBpm)

stateWeight = 1 (piece.state = maintenance)
            | 3 (piece.state = performance)

daysSinceLastPracticed = 999 if piece.lastPracticed is null
                       | (now − piece.lastPracticed) in whole days

BPM term:
  = 0 if piece.targetTempoBpm is null OR piece.lastAchievedTempoBpm is null
  = max(0, piece.targetTempoBpm − piece.lastAchievedTempoBpm) otherwise
```

Tie-break: `createdAt` ASC, then `title` ASC. Block opens piece practice screen without sectionId.

Pieces in states `on_hold` or `shelved` are excluded from all slots.

### 6.6 Technique selection

Domain pool: techniques with `state ∈ {active, maintenance}` (retired excluded).

**Count per slot:** `count = clamp(floor(slotMin / 5), 1, 3)`.

**Active vs maintenance split:**
- slot < 8 min → 100% active, 0 maintenance
- 8 ≤ slot ≤ 14 min → 1 maintenance, rest active
- slot > 14 min → 1–2 maintenance (max 1 if count = 2; up to 2 if count = 3), rest active

If active pool empty → all picks from maintenance. If both empty → technique block dropped, minutes → repertoire.

**Score formula:**

```
score(technique) = stateScorePerDay × daysSinceLastPracticed + qualityEffortBonus

stateScorePerDay = 10 (technique.state = active)
                 |  2 (technique.state = maintenance)

daysSinceLastPracticed = 999 if technique.lastPracticedAt is null
                       | (now − technique.lastPracticedAt) in whole days

qualityEffortBonus = 2 × ((effort − 1) + (5 − quality))

  effort = technique.lastEffort,  default 1 if null
  quality = technique.lastQuality, default 5 if null
  (defaults make missing data contribute 0 to bonus)
```

Highest score wins within each sub-pool (active / maintenance). Tie-break: `dateIntroduced` ASC, then `title` ASC.

Per-technique allocated minutes within a multi-technique slot: divide evenly. Minimum floor 3 min per technique; if floor would be violated, reduce count by 1 and re-divide.

### 6.7 Warmup selection (60+ min sessions)

Pool: techniques with `state = maintenance`. Pick longest-not-practiced (LNP), tie-break by `dateIntroduced` ASC.

If no maintenance techniques exist: warmup block still shown, body says "Warmup — your choice of scales", uses minimal sight-reading-style UI (timer + Done, no log).

### 6.8 Deterministic regeneration

Same inputs + same Firestore data + same wall-clock day → same plan. No randomness. "Regenerate" button on setup screen recomputes (only changes if data changed).

## 7. Out of Scope

- Rich block template schema (focus categories, BPM default strategies, duration bands) — deferred indefinitely; planner uses runtime block instances only
- Seam exercises and join blocks (A → B → A+B) — deferred to a future Phase 4 expansion
- Sight-reading material model + logging — deferred
- Saving generated sessions to Firestore (for review history) — sessions stay ephemeral
- Per-block "rationale" UI ("why was this block chosen") — `rationale` field exists in the model but not surfaced in MVP
- Tuning the 55/30/15 repertoire sub-split via settings — hardcoded for MVP
- Coach mode for techniques without an existing practice screen — N/A, both exist
- BPM-bump nudges and section phase transition nudges — deferred to Phase 5
- Recommendation logic that considers accuracy instability beyond the existing `lastTechnicalMistakes` denorm — deferred to Phase 5
- Push notifications / reminders — deferred
- Edge case: simultaneous active sessions across devices (web + mobile) — last-write-wins behavior accepted; no conflict UI

## 8. Phases

Each phase is independently deliverable and small enough for one sub-agent session.

### Phase 1: Data model + AsyncStorage scaffolding

- Add dependency `@react-native-async-storage/async-storage`
- Create `models/session.ts` with `SessionEmphasis`, `BlockKind`, `PlannedBlock`, `SessionPlan`, `SessionInputs`, `BlockExecutionState`, `ActiveSession` types
- Extend `PracticeTrigger` in `models/practice.ts` to include `'session-coach'`
- Create `utils/session-storage.ts` with read/write helpers for `session-inputs:{uid}:{emphasis}` and `active-session:{uid}`
- Add unit tests for storage round-trip

### Phase 2: Planner logic (pure functions, no UI)

- Create `utils/session-planner.ts` with:
  - `allocateTime(inputs: SessionInputs): { warmup, technique, sightReading, repertoireLearning, repertoireStabilizing, repertoireMaintenance }`
  - `pickRepertoireSection(slot: 'learning' | 'stabilizing', pieces, sections): PlannedBlock`
  - `pickRepertoireMaintenance(pieces): PlannedBlock`
  - `pickTechnique(slot, techniques, count): PlannedBlock[]`
  - `pickWarmup(techniques): PlannedBlock`
  - `buildPlan(inputs, pieces, sections, techniques): SessionPlan`
- Comprehensive unit tests covering: each duration × emphasis cell, redistribution when domains disabled, empty-state pieces/techniques, threshold drops (< 12 min, < 7 min, < 8 min), tie-breaks, BPM gap logic, performance × 3 weight

### Phase 3: Setup screen

- Create `app/(app)/session/_layout.tsx` (stack)
- Create `app/(app)/session/setup.tsx` with:
  - Route param `emphasis` (default `balanced` if absent)
  - Form: minutes slider (15–90, step 5), technique switch, sight-reading switch, emphasis chip
  - Live preview of allocated minutes per block (run planner in preview mode)
  - Per-emphasis last-used input restoration from AsyncStorage
  - `[Start session]` button → writes inputs → generates plan → writes active session → routes to `/session/coach`
- i18n keys for all UI strings

### Phase 4: Coach screen + shell wrapper

- Create `components/practice/CoachShell.tsx`:
  - Dual progress bars at top with elapsed/remaining text
  - Skip + Extend (+2 min) buttons in a toolbar
  - "Save & next block" CTA that wraps `useSavePractice` / `useSaveTechniqueLog` plus advance logic
  - Persists `ActiveSession` to AsyncStorage on every state change
  - Soft sound + color change when block timer hits 0
- Create `contexts/CoachContext.tsx` with `coachMode`, `onSaveNext`, `currentBlock`, etc.
- Create `app/(app)/session/coach.tsx`:
  - Reads `ActiveSession` from AsyncStorage
  - Renders the right body for current block kind (technique screen / piece screen / sight-reading minimal)
  - Wraps body in `<CoachShell>`
- Modify existing `piece/[id]/practice.tsx` and `technique/[id]/practice.tsx` to consume `CoachContext`: when `coachMode = true`, hide their own Save button (shell provides it)
- Create minimal sight-reading body component (timer + Done)
- Handle resume: on app foreground / Overview mount, check for active session, jump to coach if user taps Resume

### Phase 5: Overview integration + resume banner

- Modify `app/(app)/(tabs)/overview.tsx`:
  - Add "New Practice Session" section at the top with four list items (Balanced / Technique focused / Reading focused / Repertoire focused), each with a play icon button that routes to `/session/setup?emphasis={emphasis}`
  - If active session present in AsyncStorage: replace the section with a resume banner showing emphasis, total minutes, current block label, `[Resume]` and `[End]` buttons
- i18n keys for all new strings

### Phase 6: Summary screen + session end flow

- Create `app/(app)/session/summary.tsx`:
  - Stats: total practiced minutes vs allotted, blocks done vs skipped, list of blocks with their actual minutes
  - `[Done]` button clears active session + routes to Overview
- Wire coach `[Save & next]` after the last block → navigate to summary
- Wire `[End]` from resume banner → clear active session, no summary

### Phase 7: Lint + i18n + accessibility + Playwright verification

- Run `yarn lint` and fix all issues (including pre-existing)
- Verify all new UI text uses i18n keys (no hardcoded strings)
- Add `accessibilityLabel` / `accessibilityHint` to all icon-only buttons (play, skip, extend, resume, end)
- Manual end-to-end test via Playwright (local server at http://localhost:8081, login senth.wallace@gmail.com / hellomynameispassword123):
  - First-launch defaults (30 min, all on) for each emphasis
  - 15 / 30 / 45 / 60 / 90 minute sessions per emphasis: verify allocations match the reference table
  - Interpolation: pick 20 min, 50 min — verify minutes sum to total
  - Disable sight-reading: minutes redistribute to repertoire
  - Setup persists last-used values per emphasis
  - Coach: dual progress bars run, soft cue at 0, skip + extend work
  - Save & next: PiecePractice writes with `triggeredFrom: 'session-coach'`, sectionId set for learning/stabilizing, null for maintenance
  - Section scoring: pick a piece with multiple learning sections of varying staleness + BPM gaps; verify the right one is picked
  - Performance pieces: confirmed × 3 weight in maintenance slot
  - Resume: close coach mid-session, return to Overview → see resume banner → resume jumps back
  - End from resume banner clears active session
  - Summary screen shows correct totals + skipped count
  - Empty-state coverage: 0 pieces, 0 techniques, 0 learning pieces — verify redistribution + empty-state messages
