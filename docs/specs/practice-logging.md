# Practice logging

Tracking issues: [#70](https://github.com/Senth/my-musical-repertoire/issues/70),
[#102](https://github.com/Senth/my-musical-repertoire/issues/102)

## 1. What

Everything that happens on a practice screen: what the student is shown before
they play, what they can enter, what gets written, and what comes back
afterwards. Three screens share the model — whole-piece practice, section
practice and technique practice — and all three render identically inside the
session coach, which wraps them rather than replacing them.

The defining decision is that a logged value is **tagged by mode**. Practice is
split along two independent axes — **Hands** (`LH` / `RH` / `HT`) for sections and
techniques, and **Drill** (`normal` / `staccato`) for techniques — so BPM, quality
and effort are recorded per mode instead of collapsing into one ambiguous number.

## 2. Why

`Section.currentBpm` and `TechniqueItem.lastAchievedTempoBpm` used to carry no
mode tag. A student who runs the left hand at 111 BPM and hands together at 72
ended up with whichever value was saved last. The recommendation engine then
either congratulated them on a tempo they can only reach one-handed, or held them
at a tempo they long outgrew hands-separately. Neither is correct, and no
BPM-bump or hands-separate→hands-together suggestion can be built on top of it.

Tagging every logged value by mode fixes the data at its source and unlocks the
one signal that actually matters pedagogically: **both hands are clean above
target — try them together.**

The two axes are kept deliberately separate. Hands is a progression ladder (LH
and RH lead to HT). Drill is a practice tool — you play a scale staccato to
improve your legato, you do not graduate from staccato. Conflating them would
imply a progression that does not exist.

### Vocabulary

The user-facing terms are **Hands** and **Drill**. Do not call the second axis
"mode" in UI copy — pianists read "mode" as Dorian/Phrygian. `mode` remains fine
as an internal/code term for a hands+drill pair.

## 3. Data model

### Mode types (`models/practice.ts`)

```ts
export type HandsMode = "LH" | "RH" | "HT";
/** Which hands a technique is practised with. Drives which chips appear. */
export type TechniqueHandsMode = "together" | "separate" | "both";
/** Only `staccato` is selectable. */
export type PracticeDrill = "staccato";

/** `"LH"` / `"RH"` / `"HT"` for the plain drill; `"LH.staccato"` when one is on. */
export type ModeKey = string;

export interface ModeStats {
  bpm?: number | null;
  quality?: 1 | 2 | 3 | 4 | 5 | null;
  effort?: 1 | 2 | 3 | 4 | 5 | null;
  lastPracticed?: Date | null;
}

/** Sparse — only modes actually practised are present. */
export type ByMode = Record<ModeKey, ModeStats>;

export type PracticeTrigger =
  | "full-piece" | "section-panel" | "direct" | "session-coach";

export enum PracticeMistakes { none, few, some, many, everywhere }
```

`Section` gains `byMode` (keys `LH`/`RH`/`HT` only — sections never have a drill
axis). `TechniqueItem` gains `byMode`, `handsMode` (default `"separate"` when
absent) and `activeDrills` (default `[]`).

### Derived values

Rolled up on every save, for display and for surfaces that want one number:

- `TechniqueItem.lastAchievedTempoBpm` = **minimum `bpm` across present hands
  modes**, drill keys excluded.
- `lastQuality` / `lastEffort` = values from the most recently practised mode.
- `lastPracticed` / `lastPracticedAt` = maximum `lastPracticed` across all modes,
  drills included.

**`Section.currentBpm` does not exist.** It was removed in
[#107](https://github.com/Senth/my-musical-repertoire/issues/107): `byMode` is
the only stored tempo for a section, and any surface needing one number calls
`deriveCurrentBpm(section.byMode)` at read time — the same minimum-over-hands
rule. `lastQuality` / `lastEffort` / `lastPracticed` remain stored on the section.

`Piece.learningPhase` (and `LearningPhase` / `LEARNING_PHASES`) was **deleted**.
It was write-only, and its values (`hands_separate`, `hands_together_slow`, …)
would have sat confusingly beside the real hands axis.

### Practice log documents

All three are subcollections and additive; none required a rules change.

| Path | Fields |
| --- | --- |
| `users/{uid}/pieces/{pid}/practiceLogs/{id}` | `date`, `technicalMistakes`, `memoryMistakes`, `achievedBpm`, `flaggedSectionIds`, `triggeredFrom`, `sessionId` |
| `users/{uid}/pieces/{pid}/sections/{sid}/practiceLogs/{id}` | `date`, `quality`, `effort`, `achievedBpm`, `hands`, `drill`, `triggeredFrom`, `sessionId`, `source?` |
| `users/{uid}/techniques/{tid}/practiceLogs/{id}` | `date`, `quality`, `effort`, `achievedBpm`, `hands`, `drill`, `triggeredFrom`, `sessionId` |

Whole-piece logs have **no hands axis** — a run-through is hands-together by
definition. `source: "run-through"` appears only on section logs written as
run-through credit ([`section-phases.md`](section-phases.md)); it is optional and
absent on every other log.

`flaggedSectionIds` records which sections the student ticked as problematic
during a whole-piece run; `triggeredFrom` distinguishes a proactive drill from an
error-driven one.

## 4. Targets

`utils/practice-modes.ts`:

```ts
export const HS_TARGET_MULTIPLIER = 1.15;
```

- Effective target for a section: `section.targetBpmOverride ??
  piece.targetTempoBpm ?? null`; for a technique: `technique.targetTempoBpm`.
- `HT` target = the effective target. `LH` / `RH` target =
  `round(effectiveTarget × 1.15)`.
- **A drill does not change the target.** `LH.staccato` is measured against the
  hands-separate target, same as `LH`.

15% rather than 20% because 20% suits fast etude figuration but is too aggressive
for slow cantabile writing, where tone and voicing are the actual work. It is a
**constant, not a stored field** — no settings document, no rules change.

Both targets are shown on the practice screen so the student never does the
arithmetic:

```
Target 111 BPM (hands separate)
       96 BPM (hands together)
```

## 5. Preselection and readiness

When a practice screen opens, the preselected hand is the **worse** one:

1. largest gap to the hands-separate target (a never-practised hand counts as an
   infinite gap, so it always wins),
2. tie-break on lower last `quality`,
3. tie-break on longer since last practised.

**Except** when both `LH` and `RH` have `bpm >= hsTarget`, in which case `HT` is
preselected and a single explanatory line appears under the chips:

```
Hands  [🖐 LH] [🖐 RH] [🙌 HT*]
Both hands reached 111 BPM — try hands together
```

The readiness rule is **BPM-only, deliberately not gated on quality**. Quality has
no default (§6), so a quality gate would stall the nudge indefinitely on any mode
where the student skipped it.

A caller may name the mode instead, via the `preselectMode` prop, and it takes
precedence so the student lands on the hand that drove the pick: the coach passes
`PlannedBlock.modeKey`, and an Overview section card passes its `mode` query param
([`planner-scoring.md`](planner-scoring.md) §7). `reachablePreselect` drops a mode
the item cannot offer, so a stale or hand-edited param degrades to the rule above
rather than erroring. The drill chip always defaults to `normal`. Techniques with `handsMode:
"separate"` have no `HT`, so no readiness rule and no hint.

Preselection is derived live from `byMode` when the screen opens, never baked
into the plan: a value computed at 08:00 would be stale by 09:00.

## 6. Ratings, dirty tracking and the save gate

`quality` and `effort` start **unselected** (`null`) for every mode. They used to
default to `3`, which silently logged a middling rating the student never gave.

- A mode is **dirty** when its `bpm`, `quality` or `effort` differs from what was
  prefilled. Tapping a chip merely to *look* at another hand's numbers does not
  dirty it.
- **Dirty is sticky.** Reverting `bpm` to its prefilled value does not clear the
  flag — the student may have practised at a different tempo and then typed the
  original back. Once a mode is touched it stays dirty for the screen's life.
- A log is written for **every mode that has both `quality` and `effort` set**.
- Save is blocked unless **at least one** mode is complete **and every dirty mode
  is complete**. Nudging LH's BPM and then fully rating RH blocks the save until
  LH is rated too.
- The block message names the offending mode: *"Left hand needs quality and
  effort"*.

Switching chips never writes anything — all modes are held in form state
(`hooks/use-mode-drafts.ts`) and written together on Save.

Inside the coach this needs no extra mechanism: `handleSaveAndNext` returns early
when the save reports `saved: false`, so an incomplete block will not advance.
Skip remains the escape hatch.

### Estimation fields

Quality, effort and mistake level are entered through `EstimationField`, and
every one of them runs **worst → best, left → right**. That means quality counts
up (1 fell apart … 5 clean) while effort and mistakes count *down*, since low
effort and no mistakes are the good outcomes. Only the render order changes —
stored values are untouched.

## 7. BPM control

`components/practice/BpmControl.tsx` replaces the bare BPM `TextInput` on every
practice screen and in the sight-reading block:

```
┌─────────────────────────────┐  ┌───────────┐
│         TextInput (BPM)     │  │ Metronome │
└─────────────────────────────┘  └───────────┘
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐
│  −1 │+1 │ │  −5 │+5 │ │ −10 │+10 │ │   ½  │ ×2 │
└─────────┘ └─────────┘ └──────────┘ └───────────┘
[HelperText error if invalid]
```

Typing into a number field during live practice is disruptive; the increments
cover the real cases (±1 fine tuning, ±5/±10 Hanon/Czerny stepping, halve/double
for subdivision work). ±2 was rejected as pedagogically unnecessary.

- Action-only segmented buttons — no selection state.
- Always enabled mid-run; the metronome picks up changes through its existing
  debounce. Disabled only when the field is empty or non-numeric.
- All adjustments clamp to **[20, 240]**. Halve is `round(n / 2)` floored at 20;
  double is `min(n × 2, 240)`.
- Fully controlled, no internal state.

Achieved BPM is never auto-updated from metronome changes — it stays a
deliberate, manually entered value.

## 8. Last-session reference card

`components/practice/LastSessionCard.tsx` renders a read-only **"Last session —
for reference"** block at the top of the practice content column, above the BPM
input, on all three screens and therefore inside the coach.

A teacher's most useful note is "where we were last time". The app already
captured this and only surfaced it *after* saving, in the post-save comparison.

**Source of truth is the actual latest log document**, not the cached `last*`
fields on the parent doc: those can lag `lastPracticed` in edge cases (a section
credited during a whole-piece run updates recency but not quality/effort), and
reading the log keeps date and metrics coherent. `hooks/use-last-practice-log.ts`
does a one-shot `getDocs` at mount, `orderBy("date","desc")`, so it reflects the
state **before** the log the student is about to create. It also returns the raw
log window (`MODE_LOG_LIMIT` = 25) plus the newest log per mode, which
[`section-phases.md`](section-phases.md) consumes.

**Piece scope is full-piece logs only.** "Last session" on the whole-piece screen
means "last time I ran the whole piece", with coherent technical/memory mistake
fields. Section-only work surfaces on each section's own screen.

Body, in pedagogical priority order:

- **Tempo (all):** `{achievedBpm} BPM` plus `(target {n})` when one exists; `—`
  when no BPM was logged.
- **Section / technique:** `Quality` then `Effort` (effort de-emphasized).
- **Piece:** `Technical` and `Memory` mistake levels.

Header is `Last session · {formatDaysAgo(date)}`; past a **10-day** threshold it
switches to the "after a break" framing.

**Anchoring guardrails:** it is labelled "for reference" and styled neutrally —
`surfaceVariant` container, no red/green, no up/down arrows. The verdict belongs
in the post-save comparison, not here. Single last log only, no trend.

First practice renders a muted single line instead of the card; while loading it
renders nothing, so nothing flashes.

The scoped-section screen also shows the section's `SectionPhaseChip` in the
identity block, so the student frames tempo expectations correctly — a low BPM is
expected in `learning`.

**BPM prefill is unchanged** by the card: the input still prefills from the
section's derived BPM / `lastAchievedTempoBpm`. The card is informational only.

## 9. Sections panel

`components/practice/SectionsPracticePanel.tsx` sits between the mistake fields
and the Save button on the whole-piece screen, hidden when the piece has no
sections. It replaced a modal `RadioButton` section picker — two competing UIs
for the same job.

```
Sections — tap the ones that were problematic
────────────────────────────────────────────
[☐] Bridge  [learning]     72 / 96 BPM   [Practice →]
[☑] Coda    [stabilizing]  60 / 96 BPM   [Practice →]
[☐] Intro   [maintenance]  96 / — BPM    [Practice →]
```

Each row shows the label, an editable `SectionPhaseChip`, a BPM line (derived
current / effective target, hidden when both are null) and optional notes.
`[Practice →]` navigates to the section-scoped practice screen, which saves with
`triggeredFrom: "section-panel"`.

Checkboxes are shown at **every** mistake level on maintenance and performance
pieces, because unticked there means *credited* — the student must always be able
to withhold credit, and they often know the exact bar that fell apart after an
otherwise clean run. On other pieces they appear at `mistakes >= some`. They
render only on rows where ticking would do something; ticked ids become
`flaggedSectionIds` on save. What ticking *means* for a maintenance piece is
[`section-phases.md`](section-phases.md).

## 10. Save path

`useSavePractice` (whole piece) commits the piece log, the piece rollup, and every
section credit/demotion in **one `writeBatch`** through `awaitWrite`. An
8-section piece goes from ~18 round trips to one, the save is atomic, and it
queues offline as a single unit. Section state is read from the caller's live
`useSections` snapshot rather than re-fetched, which keeps the save working
offline where `getDoc` may reject.

`useSaveSectionPractice` / `useSaveTechniqueLog` take an **array of per-mode
entries** (`hands`, `drill`, `bpm`, `quality`, `effort`), write one log doc per
entry, merge each into `byMode[key]`, then recompute and write the derived
rollups.

## 11. Post-save comparison

`PracticeComparison` / `TechniqueLogComparison` render **one compact before/after
block per saved mode**, each against that mode's own previous log:

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

A single-mode save looks exactly as it did before modes existed. The `previous*`
values come from the same `useLastPracticeLog` fetch the reference card uses —
one read path, and the mount-time fetch is the correct "previous" for both. One
consequence is intended: a section's "previous tempo" is the last **achieved**
BPM from the log, not a stored working BPM, so the comparison is achieved vs
achieved.

## 12. UI by screen

**Section practice** (`/piece/[id]/practice?sectionId=…`): hands chips, an
always-visible all-modes summary line (`LH 111 · RH 104 · HT 72`) so comparing
hands needs no tapping, both target lines, mode-scoped last-session card,
unselected ratings. Tapping a chip swaps the BPM field, ratings, card and target
line — that is also how you peek at a hand without practising it.

**Whole-piece practice** (`/piece/[id]/practice`): no hands or drill chips.
Technical/memory mistakes keep their `none` default. Hands tracking lives on
sections.

**Technique practice**: same as the section screen plus a drill row when
`activeDrills` is non-empty. The hands row follows `handsMode` — `together` hides
the row entirely and tags every log `HT`; `separate` shows `[LH] [RH]` with no
readiness hint; `both` shows all three. A row offering only one choice is hidden,
not disabled — the screen is already cramped.

**Technique edit / create**: a Hands radio group (`together` / `separate` /
`both`, default `separate`) and a Staccato drill checkbox. Default `separate`
because most techniques are practised hands-separate.

**Section edit / create**: no mode fields. Sections always have all three hands
modes and never have drills.

The all-modes summary line lists only modes that are present in `byMode` **and**
reachable from the current chips. A technique switched from `both` to `separate`
keeps its old `HT` stats, but advertising a tempo the student cannot select is
noise.

## 13. Logging summary

| Field | Where | Purpose |
| --- | --- | --- |
| `hands` | every section + technique log | disambiguates BPM; feeds per-mode scoring and the readiness rule |
| `drill` | every technique log (`null` for sections) | separates drill reps from progression reps |
| `byMode[key].bpm` | Section, TechniqueItem | per-mode tempo — recall plus the score's BPM term |
| `byMode[key].quality` / `.effort` | Section, TechniqueItem | per-mode scoring; no longer silently defaulted |
| `byMode[key].lastPracticed` | Section, TechniqueItem | per-mode recency; drives the per-mode same-day filter |
| `flaggedSectionIds` | whole-piece log | which sections failed the run-through |
| `triggeredFrom`, `sessionId` | every log | proactive vs error-driven drill; joins a session to its logs |

Signals this unlocks for later work: per-mode BPM-bump suggestions,
hands-separate→hands-together nudges surfaced outside the practice screen,
staccato-lag detection, and deriving a piece's learning stage from mode history.

## 14. Migration

`scripts/migrate-bymode.mjs` backfills `byMode` for documents that predate it,
via the Admin SDK over `collectionGroup("sections")` and
`collectionGroup("techniques")` — not a `users` listing, because `users/{uid}`
parent documents do not exist. Where `byMode` is absent and a legacy tempo is
present it writes `{ bpm, quality, effort, lastPracticed }` under:

- **sections** → `byMode.HT` — section and whole-piece practice was hands
  together.
- **techniques** → `byMode.LH` *and* `byMode.RH` — techniques default to
  hands-separate, so an untagged tempo was reached one hand at a time. Writing
  `HT` would claim a tempo the student never played and strand it on a mode the
  chips do not offer.
- **techniques with `handsMode: "together"`** → `byMode.HT`.

`--dry-run` writes nothing. There is deliberately **no read-time synthesis
fallback** — the script is the single source of truth.

## 15. Out of scope

- **Drill axis on sections or whole pieces** — techniques only.
- **Custom, user-named drills** and any drill beyond `staccato`.
- **Per-drill target BPM or multiplier**; overriding `HS_TARGET_MULTIPLIER` per
  item or per user.
- **Hands tracking on whole-piece practice.**
- **`PlannedBlock.suggestedHands`** — preselection is derived live (§5).
- **Reading `hands` / `drill` back out** in any history or chart view.
- **Per-log "note for next time" free-text field** →
  [#16](https://github.com/Senth/my-musical-repertoire/issues/16).
- **Multi-log trend / sparkline** in the reference card; realtime updates of it.
- **Regression verdict, colouring or arrows** in the reference card.
- **Per-section-row last log** inside the sections panel.
- **The reference card on detail screens** — logging screens and the coach only.
- **Sight-reading reference** — those blocks have no per-item log.
- **Start/end BPM logging triad** and the >20 BPM soft-prompt warning.
- **`focusType`** (accuracy / tempo-building / continuity / memory) per log.
- **Duration estimate per section**; a "fixed" resolution state per flagged
  section.
- **Deriving a piece learning stage from mode history** — `learningPhase` was
  deleted, not rewired.
- **Cold-recall rating** taken before repair →
  [#97](https://github.com/Senth/my-musical-repertoire/issues/97).
