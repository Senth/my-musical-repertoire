# Spec: Practice Hands & Drill Modes

## Phase 0: Handoff

**Spec file:** `docs/specs/practice-hands-and-drill-modes.md`

**Tracking issue:** #70

**Implementer instructions:**

- Use the Phases section (Phase 1–10) as your implementation plan. Work them in order — later phases depend on earlier ones.
- Tracking: GitHub Issues + Kanban board (no PLAN.md). Close with `Closes #70` in the PR body, then run `scripts/sync-todo.sh`.
- Run `yarn lint` and `yarn test` after each phase. Fix all issues, including pre-existing ones.
- Manual testing via playwright skill (login: `senth.wallace@gmail.com` / `hellomynameispassword123`). Port: `8081` if `$PWD` ends in exactly `my-musical-repertoire`, otherwise `8082` (worktree).
- Never commit — the user reviews and commits manually.
- Do **not** run the migration script (Phase 9) against production without explicit user confirmation.
- Respond in caveman ultra.

---

## 1. What

Split practice logging along two independent axes — **Hands** (`LH` / `RH` / `HT`) for sections and techniques, and **Drill** (`normal` / `staccato`) for techniques — so BPM, quality and effort are recorded per mode instead of collapsing into one ambiguous number, and the app can tell you which hand needs work and when both hands are ready to combine.

## 2. Why

`Section.currentBpm` and `TechniqueItem.lastAchievedTempoBpm` carry no mode tag. A student who runs left hand at 111 BPM and hands together at 72 BPM ends up with whichever value was saved last. The recommendation engine then either congratulates them on a tempo they can only reach one-handed, or holds them at a tempo they long outgrew hands-separately. Neither is correct, and no BPM-bump or hands-separate→hands-together suggestion can be built on top of it.

Tagging every logged value by mode fixes the data at its source and unlocks the one signal that actually matters pedagogically: **both hands are clean above target — try them together.**

The two axes are kept deliberately separate. Hands is a progression ladder (LH and RH lead to HT). Drill is a practice tool — you play a scale staccato to improve your legato, you do not graduate from staccato. Conflating them would imply a progression that does not exist.

### Vocabulary

The user-facing terms are **Hands** and **Drill**. Do not call the second axis "mode" in UI copy — pianists read "mode" as Dorian/Phrygian. `mode` remains fine as an internal/code term for a hands+drill pair.

## 3. Data Model

### New types (`models/practice.ts`)

```typescript
export type HandsMode = "LH" | "RH" | "HT";
export const HANDS_MODES: HandsMode[] = ["LH", "RH", "HT"];

/** Which hands a technique is practised with. Drives which chips appear. */
export type TechniqueHandsMode = "together" | "separate" | "both";
export const TECHNIQUE_HANDS_MODES: TechniqueHandsMode[] = [
  "together",
  "separate",
  "both",
];

/** Drill variations. Only `staccato` is selectable in this issue. */
export type PracticeDrill = "staccato";
export const PRACTICE_DRILLS: PracticeDrill[] = ["staccato"];

/**
 * Composite key into a `ByMode` map. `"LH"` / `"RH"` / `"HT"` for the plain
 * (normal) drill; `"LH.staccato"` etc. when a drill is active.
 */
export type ModeKey = string;

export interface ModeStats {
  bpm?: number | null;
  quality?: 1 | 2 | 3 | 4 | 5 | null;
  effort?: 1 | 2 | 3 | 4 | 5 | null;
  lastPracticed?: Date | null;
}

/** Sparse — only modes actually practised are present. */
export type ByMode = Record<ModeKey, ModeStats>;
```

### `Section` (`models/section.ts`)

```typescript
byMode?: ByMode;
```

`currentBpm`, `lastQuality`, `lastEffort` and `lastPracticed` stay, and are **maintained as derived display values** (see §5). Sections never get a drill axis — their `byMode` keys are only `LH` / `RH` / `HT`.

### `TechniqueItem` (`models/technique.ts`)

```typescript
byMode?: ByMode;
handsMode?: TechniqueHandsMode;   // default "separate" when absent
activeDrills?: PracticeDrill[];   // default [] when absent
```

`lastAchievedTempoBpm`, `lastQuality`, `lastEffort`, `lastPracticedAt` stay as derived display values.

### `Piece` (`models/piece.ts`) — removals

`learningPhase`, the `LearningPhase` type and `LEARNING_PHASES` are **deleted**. The field is write-only today (set in `app/(app)/piece/[id]/edit.tsx:149`, read by nothing) and its values (`hands_separate`, `hands_together_slow`, …) would sit confusingly beside the real hands axis.

### Practice log documents — additive fields

Section logs (`users/{uid}/pieces/{pid}/sections/{sid}/practiceLogs/{id}`) and technique logs (`users/{uid}/techniques/{tid}/practiceLogs/{id}`) each gain:

```typescript
hands: HandsMode; // "LH" | "RH" | "HT"
drill: PracticeDrill | null; // null = normal
```

Piece-level logs (`…/pieces/{pid}/practiceLogs/{id}`) are **unchanged** — whole-piece practice has no hands axis.

All new fields are additive and nullable. No `firestore.rules` change and no rules deploy is required; the migration in Phase 9 uses the Admin SDK, which bypasses rules.

## 4. Targets

New module `utils/practice-modes.ts`:

```typescript
export const HS_TARGET_MULTIPLIER = 1.15;
```

- Effective target for a section: `section.targetBpmOverride ?? piece.targetTempoBpm ?? null`
- Effective target for a technique: `technique.targetTempoBpm ?? null`
- `HT` target = effective target
- `LH` / `RH` target = `Math.round(effectiveTarget * 1.15)`
- A drill does **not** change the target. `LH.staccato` is measured against the hands-separate target, same as `LH`.

15% (not 20%) is the default because 20% suits fast etude figuration but is too aggressive for slow cantabile writing where tone and voicing are the actual work. The multiplier is a **constant, not a stored field** — no settings document, no rules change. Revisit as its own issue if a specific piece needs a different bar.

Both targets are shown on the practice screen so the student never does the arithmetic:

```
Target 111 BPM (hands separate)
       96 BPM (hands together)
```

## 5. Derived values

Recomputed on every save, for display and for backwards compatibility with surfaces that expect one number:

- `Section.currentBpm` = **minimum `bpm` across present _hands_ modes** (`LH`, `RH`, `HT`). Drill keys are excluded.
- `TechniqueItem.lastAchievedTempoBpm` = same rule over the technique's `byMode`.
- `lastQuality` / `lastEffort` = values from the most recently practised mode.
- `lastPracticed` / `lastPracticedAt` = maximum `lastPracticed` across all modes, drills included.

This keeps `components/practice/SectionsPracticePanel.tsx:52` and `utils/overview-suggestions.ts:68` working **unchanged**, and keeps the section row uncluttered — one BPM number, not three.

## 6. Preselection & readiness

When a practice screen opens, the hand chip preselected is the **worse hand**:

1. Largest gap to the hands-separate target (a never-practised hand counts as an infinite gap, so it always wins)
2. Tie-break: lower last `quality`
3. Tie-break: longer since last practised

**Except:** when both `LH` and `RH` have `bpm >= hsTarget`, `HT` is preselected instead.

The readiness rule is BPM-only — deliberately **not** gated on quality. Quality has no default (§7), so a quality gate would stall the nudge indefinitely on any mode where the student skipped it.

When `HT` is preselected for this reason, a single explanatory line appears under the chips:

```
Hands  [🖐 LH] [🖐 RH] [🙌 HT*]
Both hands reached 111 BPM — try hands together
```

Drill chip always defaults to `normal`.

Techniques with `handsMode: "separate"` have no `HT` mode, so no readiness rule and no hint.

## 7. Ratings, dirty tracking and the save gate

`quality` and `effort` start **unselected** (`null`) for every mode. Today they default to `3` (`app/(app)/piece/[id]/practice.tsx:124`, `app/(app)/technique/[id]/practice.tsx:80`), which silently logs a middling rating the student never gave.

- A mode is **dirty** when its `bpm`, `quality` or `effort` differs from what was prefilled. Tapping a chip merely to _look_ at another hand's numbers does not dirty it.
- Reverting `bpm` to its prefilled value does NOT clear the dirty flag. The student might have practiced at a different BPM and then returned to the initial value. Dirty is sticky: once a mode is touched it stays dirty for the rest of the screen's life.
- A log is written for **every mode that has both `quality` and `effort` set**.
- Save is blocked unless **at least one** mode is complete **and every dirty mode is complete**. So nudging LH's BPM and then fully rating RH blocks the save until LH is rated too.
- The block message names the offending mode: _"Left hand needs quality and effort"_.

**Coach integration needs no new mechanism.** `app/(app)/session/coach.tsx:183` already returns early from `handleSaveAndNext` when `result.saved === false`, so an incomplete block simply will not advance. Skip remains the escape hatch.

Switching chips never writes anything — all modes are held in form state and written together on Save.

## 8. Scoring (`utils/planner-scoring.ts`)

Scoring becomes per-mode:

- Score **each mode present in `byMode`** using that mode's own `bpm`, `quality`, `effort` and `lastPracticed`, with the existing formulas:
  - `maintenance`: `days + (effort - 1) + (5 - quality)`
  - otherwise: `PHASE_SCORE[phase] * days + bpmTerm`, where `bpmTerm = max(0, targetForMode - bpm)`
- The item's score is the **maximum** across its modes. Record which mode won.
- Modes **absent** from `byMode` are not scored — otherwise `daysSince(null) = 999` would make every maintenance section with an unplayed LH outrank the entire board.
- If `byMode` is empty or absent entirely, fall back to a single pseudo-mode built from the item-level legacy fields — i.e. exactly today's behaviour, including the `999` score for a never-practised item.
- **Drill modes are scored**, against the same target as their hands mode. Staccato genuinely needs to reach target; a large gap means it genuinely needs work, and it converges as the student improves.
- The practiced-today filter (`isPracticedToday`, `utils/planner-scoring.ts:168`) becomes **per-mode**: only modes practised today are dropped, so a section drilled LH this morning can come back for RH this afternoon. A section is dropped entirely only when every one of its present modes was practised today.

`models/session.ts` is **unchanged** — no `PlannedBlock.suggestedHands`. The practice screen derives the preselected hand live from `byMode` when it opens, which is always current; a value baked into the plan at 08:00 would be stale by 09:00.

## 9. UI flow

### Section practice screen (`/piece/[id]/practice?sectionId=…`)

```
Bridge  [learning]

Hands  [🖐 LH] [🖐 RH] [🙌 HT*]
LH 111 · RH 104 · HT 72        (target 111/96)
Both hands reached 111 BPM — try hands together

─ Last hands together: 4 days ago
  Tempo: 72 BPM (target 96)
  Quality: —   Effort: —

Target 111 BPM (hands separate)
       96 BPM (hands together)
[BPM input] [♪]   [−1][+1] [−5][+5] [÷2][×2]

Quality  [1][2][3][4][5]      ← nothing preselected
Effort   [1][2][3][4][5]      ← nothing preselected

Sections panel (piece scope only — not shown here)

[Save]
```

- The all-modes summary line (`LH 111 · RH 104 · HT 72`) is **always visible**, so comparing hands needs no tapping. It lists only modes the chips can reach (§12 Phase 4).
- Tapping a chip swaps the BPM field, ratings, last-session card and target line to that mode. That is also how you peek at a hand without practising it.
- `LastSessionCard` is scoped to the selected mode.

### Whole-piece practice screen (`/piece/[id]/practice`)

**No changes.** No hands chips, no drill chips, `technicalMistakes` / `memoryMistakes` keep their current `none` default. Hands tracking lives on sections.

### Technique practice screen (`/technique/[id]/practice`)

Same as the section screen, plus a drill row when `activeDrills` is non-empty:

```
C major scale

Hands  [🖐 LH] [🖐 RH]
Drill  [Normal*] [Staccato]
LH 132 · RH 140 · LH staccato 96      (target 152)
…
```

- Hands row visibility follows `handsMode`:
  - `together` → **row hidden entirely**, every log tagged `HT`
  - `separate` → `[LH] [RH]`, no `HT`, no readiness hint
  - `both` → `[LH] [RH] [HT]`
- Drill row hidden when `activeDrills` is empty.
- A row offering only one choice is hidden, not rendered disabled — the screen is already cramped.

### Technique edit / create (`/technique/[id]/edit`, `/technique/new`)

Two new fields:

```
Hands   ( ) Together
        (o) Separate        ← default for new techniques
        ( ) Both

Drills  [ ] Staccato
```

Default `separate` because most techniques the user practises are hands-separate only. Custom drill names are a later issue; only `staccato` is offered.

### Section edit / create

**No changes.** Sections always have all three hand modes and never have drills.

### Post-save comparison

`PracticeComparison` / `TechniqueLogComparison` render **one compact before/after block per saved mode**, each against that mode's own previous log:

```
Bridge — saved 3 modes

Left hand       104 → 111 BPM  ↑
                quality 3 → 4  ↑
Right hand       96 → 104 BPM  ↑
                quality 3 → 3  =
Hands together   70 → 72 BPM   ↑
                quality 2 → 3  ↑

[Back to pieces]
```

A single-mode save looks exactly as it does today.

## 10. Logging

| Field                             | Where                                     | Purpose                                                          |
| --------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `hands`                           | every section + technique log             | Disambiguates BPM; feeds per-mode scoring and the readiness rule |
| `drill`                           | every technique log (`null` for sections) | Separates drill reps from progression reps                       |
| `byMode[key].bpm`                 | Section, TechniqueItem                    | Per-mode tempo — recall plus `bpmTerm`                           |
| `byMode[key].quality` / `.effort` | Section, TechniqueItem                    | Per-mode scoring; no longer silently defaulted                   |
| `byMode[key].lastPracticed`       | Section, TechniqueItem                    | Per-mode recency; drives the per-mode same-day filter            |

Signals this unlocks for later work: per-mode BPM-bump suggestions, hands-separate→hands-together nudges surfaced outside the practice screen, staccato-lag detection, and deriving a piece's learning stage from mode history instead of a hand-set field.

## 11. Out of scope

- Drill axis on sections or whole pieces — techniques only
- Custom, user-named drills (edit-screen text entry) — later issue
- The `dotted` drill and any drill beyond `staccato`
- Per-drill target BPM or per-drill multiplier — revisit if a drill needs a different bar
- Overriding `HS_TARGET_MULTIPLIER` per item or per user
- `PlannedBlock.suggestedHands` and any coach-plan changes
- Hands tracking on whole-piece practice
- Deriving a piece learning stage from mode history (`learningPhase` is deleted, not rewired)
- Mode-aware rendering of the sections panel row or overview suggestions — both keep reading the derived single BPM
- Reading `hands` / `drill` back out in any history or chart view

## 12. Phases

### Phase 1: Types + `utils/practice-modes.ts` + unit tests

- Add the new types to `models/practice.ts` (§3).
- Add `byMode?: ByMode` to `models/section.ts`.
- Add `byMode?: ByMode`, `handsMode?: TechniqueHandsMode`, `activeDrills?: PracticeDrill[]` to `models/technique.ts`.
- Create `utils/practice-modes.ts`:
  - `HS_TARGET_MULTIPLIER = 1.15`
  - `modeKey(hands, drill)` / `parseModeKey(key)` → `{ hands, drill }`
  - `hsTarget(effectiveTarget)` → rounded
  - `targetForMode(hands, effectiveTarget)`
  - `availableHandsModes(handsMode)` → `HandsMode[]`
  - `pickPreselectedHands(byMode, available, effectiveTarget)` — worse-hand rule + HT-ready override (§6)
  - `isHtReady(byMode, effectiveTarget)`
  - `deriveCurrentBpm(byMode)` — min over hands modes, drills excluded (§5)
  - `deriveLastPracticed(byMode)`, `deriveLastRating(byMode)`
- Create `utils/practice-modes.test.ts` covering: worse-hand tie-breaks, never-practised hand wins, HT-ready override, drill keys excluded from `deriveCurrentBpm`, empty `byMode`.
- Update `utils/test-factories.ts` with `byMode` / `handsMode` / `activeDrills` defaults.

### Phase 2: Delete `learningPhase`

- Remove `learningPhase`, `LearningPhase`, `LEARNING_PHASES` from `models/piece.ts`.
- Remove the dropdown, state and save wiring from `app/(app)/piece/[id]/edit.tsx` (lines ~32, 85, 103–107, 149, 199–201).
- Remove `learningPhase` from `hooks/use-pieces.ts` (lines ~22, 45, 124).
- Remove `piece.learningPhase.*` and `screen.editPiece.learningPhaseLabel` from `i18n/locales/en-US.json`.
- `yarn lint` + `yarn test` clean.

### Phase 3: Firestore read/write

- `hooks/use-sections.ts`: read `byMode`, converting each entry's `lastPracticed` Timestamp to `Date`.
- `hooks/use-techniques.ts`: read `byMode`, `handsMode` (default `"separate"`), `activeDrills` (default `[]`); allow both in the update payload type.
- `hooks/use-practices.ts` — `saveSectionPractice` takes an array of per-mode entries:
  ```typescript
  {
    hands: HandsMode;
    drill: PracticeDrill | null;
    bpm: number | null;
    quality: 1 | 2 | 3 | 4 | 5;
    effort: 1 | 2 | 3 | 4 | 5;
  }
  [];
  ```
  Writes one `practiceLogs` doc per entry (each with `hands` + `drill`), merges each into `section.byMode[key]`, then recomputes and writes the derived `currentBpm` / `lastQuality` / `lastEffort` / `lastPracticed` (§5). Piece rollup keeps updating `lastPracticed` and `lastAchievedTempoBpm` from the derived BPM.
- `hooks/use-techniques.ts` — `saveTechniqueLog` takes the same array shape and applies the same treatment to `TechniqueItem`.
- `savePractice` (whole piece) is **untouched**.
- `hooks/use-last-practice-log.ts`: add optional `modeKey` to the section and technique scopes; when present, query the newest log matching that mode. Extend `NormalizedLastLog` with `hands` / `drill`. May need a composite Firestore index — if so add it to `firestore.indexes.json` and note the deploy in the PR. Prefer fetching the newest N logs and filtering client-side if that avoids an index.

### Phase 4: `ModeSelector` component + i18n

- Create `components/practice/ModeSelector.tsx`:
  - Props: `available: HandsMode[]`, `hands: HandsMode`, `onChangeHands`, `drills: PracticeDrill[]`, `drill: PracticeDrill | null`, `onChangeDrill`, `byMode: ByMode`, `effectiveTarget: number | null`, `htReady: boolean`
  - Hands chip row with icons (`hand-back-left` / `hand-back-right` / two-hand icon from `@expo/vector-icons` MaterialCommunityIcons) plus short labels
  - Drill chip row, rendered only when `drills.length > 0`
  - Any row with fewer than two choices is not rendered
  - Always-visible all-modes summary line, showing only modes that are present in `byMode` **and** reachable from the current chips. A technique switched from `both` to `separate` keeps its old `HT` stats; advertising a tempo the student cannot select or beat is noise. The same filter applies to drill keys when a drill is turned off.
  - Readiness hint line when `htReady` and `hands === "HT"`
- Add all i18n keys under `screen.practice.modes.*` (chip labels, summary separator, target lines, readiness hint, per-mode a11y labels, the incomplete-mode save error).
- `accessibilityLabel` + `accessibilityState={{ selected }}` on every chip.

### Phase 5: Section practice screen wiring

- In `app/(app)/piece/[id]/practice.tsx`, for the `scopedSection` branch only:
  - Replace the single `achievedBpm` / `quality` / `effort` state with a `Record<ModeKey, {bpm, quality, effort}>` draft plus the selected `hands` (sections have no drill).
  - Seed each mode's draft from `section.byMode`; preselect via `pickPreselectedHands`.
  - `quality` / `effort` start `null`; `RatingField` must render with nothing selected.
  - Track dirty per mode against the seeded values; the flag is sticky (§7) — reverting does not clear it.
  - Render `<ModeSelector>` above the BPM control; show both target lines.
  - `performSave` collects every complete mode, blocks with a mode-named error when the gate fails (§7), and calls the new `saveSectionPractice` signature.
- The whole-piece branch of the same file keeps its current behaviour untouched.

### Phase 6: Technique practice + technique edit screens

- `app/(app)/technique/[id]/practice.tsx`: same treatment as Phase 5, plus the drill axis. `available` comes from `availableHandsModes(technique.handsMode)`; drills from `technique.activeDrills`. When the hands row is hidden (`handsMode === "together"`), logs are still tagged `hands: "HT"`.
- Technique edit + create screens: add the `Hands` radio group (`together` / `separate` / `both`, default `separate`) and a `Staccato` drill checkbox. Persist both.
- Verify an existing technique with no `handsMode` reads as `separate`.

### Phase 7: Per-mode comparison screens

- Extend `components/practice/PracticeComparison.tsx` and `components/technique/TechniqueLogComparison.tsx` to accept an array of per-mode results, each with its own previous values, and stack one compact block per mode with the mode's label.
- Single-mode saves must look unchanged from today.
- Fetch each saved mode's previous log via the Phase 3 `modeKey` scope.

### Phase 8: Per-mode planner scoring

- Refactor `utils/planner-scoring.ts`:
  - `scoreSectionCandidate` scores one mode; add a wrapper that scores every mode present in `byMode` and returns the max plus the winning `ModeKey`.
  - `bpmTerm` uses `targetForMode`, so `LH` / `RH` (and their drill variants) measure against the hands-separate target.
  - Empty/absent `byMode` → single fallback pseudo-mode from legacy fields.
  - `SectionCandidate` gains `modeKey: ModeKey | null`.
  - Per-mode practiced-today filter; an item drops out only when all its present modes were practised today.
  - Apply the same per-mode treatment to `scoreTechnique` / `sortTechniques` / `eligibleTechniquesInState`. Modes a technique no longer offers (`HT` after a switch to `separate`, a drill key after the drill is turned off) are excluded before scoring — an unreachable mode must not outrank a reachable one, nor keep a technique eligible after every reachable mode was practised today. Sections are unaffected: all three hands are always available.
- Update `utils/planner-scoring.test.ts` and `utils/session-planner.test.ts`. Add cases for: max-across-modes, unplayed modes ignored, maintenance section with only `HT` present, per-mode same-day filtering, legacy fallback.
- `utils/overview-suggestions.ts` stays unchanged (reads the derived `currentBpm`).

### Phase 9: Migration script

- Add `firebase-admin` as a **devDependency**.
- Create `scripts/migrate-bymode.mjs`:
  - Args: `--project <id>` (required), `--dry-run`
  - Auth via Application Default Credentials (`gcloud auth application-default login`)
  - Iterate `collectionGroup("sections")` and `collectionGroup("techniques")` — **not** a `users` listing, because `users/{uid}` parent documents do not exist
  - For each doc where `byMode` is absent/empty and `currentBpm` (or `lastAchievedTempoBpm`) is non-null, write `{ bpm, quality: lastQuality, effort: lastEffort, lastPracticed }` under:
    - **sections** → `byMode.HT` — section and whole-piece practice was hands together
    - **techniques** → `byMode.LH` _and_ `byMode.RH` — techniques are hands-separate by default (§3), so an untagged tempo was reached one hand at a time. Writing `HT` would claim a hands-together tempo the student never played and strand the value on a mode the chips do not offer.
    - **techniques with `handsMode: "together"`** → `byMode.HT`
  - Batched writes (≤ 400 per batch), progress logging, a final counts summary
  - `--dry-run` prints intended writes and writes nothing
- Document the run procedure in the script header and in the PR body:
  ```bash
  gcloud auth application-default login
  node scripts/migrate-bymode.mjs --project my-musical-repertoire-dev --dry-run
  node scripts/migrate-bymode.mjs --project my-musical-repertoire-dev
  # verify in the app, then with explicit user confirmation:
  node scripts/migrate-bymode.mjs --project my-musical-repertoire --dry-run
  node scripts/migrate-bymode.mjs --project my-musical-repertoire
  ```
- Run against **dev only**. Production is the user's call.
- No read-time synthesis fallback — the script is the single source of truth.

### Phase 10: Full verification

- `yarn lint` and `yarn test` fully clean, including pre-existing issues.
- Playwright end-to-end on the live app:
  - Section practice: three chips render, correct hand preselected for a fresh section, summary line shows only practised modes
  - Switching chips swaps BPM / ratings / last-session card and does **not** dirty the mode
  - Quality and effort render unselected; Save blocked with a mode-named error; nudging LH's BPM then rating only RH stays blocked, and stays blocked after reverting LH's BPM (sticky dirty, §7) — rating LH is the only way through
  - Saving three modes writes three logs and one before/after block per mode
  - Whole-piece practice screen visibly unchanged
  - Technique with `handsMode: "together"` shows no hands row; `separate` shows two chips and no readiness hint; `both` shows three
  - Technique with `staccato` enabled shows the drill row; `LH.staccato` BPM persists and reappears on reopen
  - Piece edit screen has no learning-phase dropdown
  - Coach block will not advance while a dirty mode is incomplete; Skip still advances
  - Both hands at ×1.15 target → `HT` preselected with the hint line
  - Verify written documents in the Firebase console: `hands`, `drill`, `byMode` keys, derived `currentBpm` equals the minimum hands BPM
- Check layout at 375 px width — the chip rows must not wrap badly or push the page into horizontal scroll.
