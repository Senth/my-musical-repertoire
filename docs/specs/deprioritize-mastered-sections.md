# Deprioritize Stabilizing/Maintenance in Recommendation Scoring

# Phase 0: Handoff

- **Spec:** `docs/specs/deprioritize-mastered-sections.md` (this file).
- **Tracking issue:** [#54](https://github.com/Senth/my-musical-repertoire/issues/54) — move to **In Progress**, then run `scripts/sync-todo.sh`.
- **Implementer:** use the **Phases** section below as the implementation plan. Deliver phases in order; each is one sub-agent session. Final phase is full test/lint + playwright E2E.
- **Follow-up issue to create** (separate `feature`): periodic full-piece **continuity run-through** trigger — insert a whole-piece block if no full run-through in X days. Orthogonal to this scoring change; out of scope here.
- After all phases verified, close #54 via PR body `Closes #54` and run `scripts/sync-todo.sh`.

---

## 1. What

Make sections/pieces that are already mastered surface **much less often** in the
recommendation engine than sections actively being learned, by reworking the
section-phase and maintenance-piece scoring formulas. Add a low-friction
promote/demote control so the student keeps phase data accurate.

## 2. Why

Observed bug: while grinding a hard learning section daily, the engine keeps
re-suggesting an already-mastered section in the same piece. Root cause: the
score's `days` term is unbounded, so a stale low-phase section eventually
overtakes a freshly-practiced learning section. The fix changes per-phase weights
and replaces the tempo-gap term with signals that actually indicate a mastered
item needs attention (quality/effort for sections, mistakes for pieces). Phase
data only helps if it's current — hence the quick promote/demote control.

The student explicitly chose **unbounded days kept** (mastered items should still
rise over time, never silently decay) over per-phase day-caps.

## 3. Data model

**No new fields. No Firestore schema or rules changes.** Every input already
exists and is already written:

| Signal | Field | Written by |
| --- | --- | --- |
| Section quality | `Section.lastQuality` (1–5, nullable) | `useSaveSectionPractice` (`use-practices.ts:117`) |
| Section effort | `Section.lastEffort` (1–5, nullable) | `useSaveSectionPractice` (`use-practices.ts:118`) |
| Piece technical mistakes | `Piece.lastTechnicalMistakes` (`PracticeMistakes` 0–4) | `useSavePractice` (`use-practices.ts:51`) |
| Piece memory mistakes | `Piece.lastMemoryMistakes` (`PracticeMistakes` 0–4) | `useSavePractice` (`use-practices.ts:52`) |

`PracticeMistakes` enum (`models/practice.ts`): `none=0, few=1, some=2, many=3, everywhere=4`.

### New scoring formulas

**Section scoring** — `scoreSectionCandidate` in `utils/planner-scoring.ts`.
`scoreSectionCandidate` and `buildSectionCandidates` must thread
`section.lastQuality` / `section.lastEffort` through (today they are dropped).

| Section phase | Score |
| --- | --- |
| `learning` | `10 * days + bpmGap` *(unchanged)* |
| `stabilizing` | `2.5 * days + bpmGap` *(weight 3 → 2.5; rises ¼ as fast as learning, keeps bpmGap)* |
| `maintenance` | `1 * days + (effort − 1) + (5 − quality)` *(no bpmGap)* |

- `bpmGap = max(0, targetBpm − currentBpm)` *(as today)*.
- Maintenance quality/effort term mirrors the existing technique bonus
  `(effort − 1) + (5 − quality)` but at **weight 1** (technique uses ×2).
  Defaults when unlogged: `effort ?? 1`, `quality ?? 5` → bonus `0`.
  (effort 5 → +4, quality 5 → +0.)
- The virtual candidate for a piece with **no sections** stays `learning` phase →
  unchanged behavior.

**Piece scoring** — `scoreMaintenancePiece` in `utils/planner-scoring.ts`
(used for pieces in `maintenance` / `performance` **state**). Drop `bpmGap`,
replace with a mistakes term at **weight 2**:

| Piece state | Score |
| --- | --- |
| `maintenance` | `1 * days + 2 * (techMistakes + memMistakes)` |
| `performance` | `3 * days + 2 * (techMistakes + memMistakes)` |

- `techMistakes = lastTechnicalMistakes ?? none(0)`, `memMistakes = lastMemoryMistakes ?? none(0)`.
- Mistakes term range `0–16`. `bpmGap` dropped entirely (a one-off slow run on a
  mastered piece should not flag it; genuine mistakes should).
- `PHASE_SCORE` constant: `stabilizing` becomes `2.5` (`maintenance` stays `1`,
  `learning` stays `10`). Maintenance section no longer uses `PHASE_SCORE` for its
  bpm/secondary term — branch the formula by phase.

## 4. UI flow

**Quick promote/demote control** via a tappable `SectionPhaseChip`
(`components/section/SectionPhaseChip.tsx`):

- Add optional prop `onChangePhase?: (phase: SectionPhase) => void`.
  - When provided → chip is pressable; tapping opens a small menu listing all
    three phases (`learning` / `stabilizing` / `maintenance`), current one marked.
    Selecting one calls `onChangePhase`. Supports **promote and demote**.
  - When absent → static chip (current behavior, e.g. read-only headers).
- **Lazy-mount the menu** (only render `<Menu>` once opened) to avoid the known
  RN-Paper Menu web focus-steal bug (see memory `project_paper_menu_focus_steal_web.md`).
- Wire `onChangePhase` in:
  - `components/section/SectionDetailRow.tsx` (piece's sections list).
  - `components/practice/SectionsPracticePanel.tsx` (during practice).
  - The write goes through `use-sections` `updateSection({ phase })`.
- The full phase picker in the section-edit screen
  (`app/(app)/piece/[id]/section/[sectionId].tsx`) stays as-is.

## 5. Logging

No new logs/collections. Phase change reuses the existing `updateSection` write
(no new audit field — `phaseChangedAt` is intentionally **not** added; it has no
consumer in this feature and would be dead data. Reconsider it with the
continuity follow-up).

**Reason copy** (`utils/overview-suggestions.ts`) must stay consistent with the
new formulas, since `reasonForCandidate` / `reasonForMaintenancePiece` recompute
the term breakdown to choose a reason key:

- `reasonForCandidate`: for `maintenance` sections there is no `bpmGap`; if the
  quality/effort bonus exceeds `1 * days`, show a new "needs cleanup" reason, else
  `daysSince`. `learning` / `stabilizing` keep the existing bpmGap-vs-days logic.
- `reasonForMaintenancePiece`: replace the bpmGap comparison with the mistakes
  term; if `2*(tech+mem) > stateWeight*days`, show a new "mistakes" reason, else
  `daysSince`.
- Add i18n keys under `screen.overview.pieceReason` in
  `i18n/locales/en-US.json`, e.g. `lastResultPoor` ("Last session needs cleanup")
  and `mistakes` ("Mistakes to clean up"). Exact copy at implementer's discretion.

## 6. Out of scope

- **Continuity full-piece run-through trigger** → separate `feature` issue.
- **Auto-promotion** of section phase from accuracy/streak signals (manual control only).
- **`phaseChangedAt`** timestamp (no consumer yet).
- **Per-phase day caps** (student chose unbounded days).
- Any Firestore schema/rules change, or new logging collection.
- The section-edit screen phase picker (unchanged).

## 7. Phases

**Phase 1 — Scoring core (`utils/planner-scoring.ts` + tests).**
Rework `scoreSectionCandidate` (branch by phase; thread quality/effort via
`buildSectionCandidates`), set `PHASE_SCORE.stabilizing = 2.5`, and rewrite
`scoreMaintenancePiece` (mistakes term, no bpmGap). Update
`utils/planner-scoring.test.ts` for the new formulas; fix any fallout in
`session-planner.test.ts` / `overview-suggestions.test.ts`. Pure logic — fully
unit-testable.

**Phase 2 — Reason copy (`utils/overview-suggestions.ts` + i18n + tests).**
Update `reasonForCandidate` and `reasonForMaintenancePiece` to match the new
formulas, add the two `pieceReason` i18n keys, update
`overview-suggestions.test.ts`.

**Phase 3 — Promote/demote UI.**
Add `onChangePhase` + lazy-mounted menu to `SectionPhaseChip`; wire it into
`SectionDetailRow` and `SectionsPracticePanel` through `use-sections`
`updateSection`. Add/extend component tests if present.

**Phase 4 — Verify end-to-end.**
Run full test suite + lint (fix all issues, including pre-existing). Playwright
E2E on the running app (main: `http://localhost:8081`): promote/demote a section
via the chip menu and confirm the phase persists; sanity-check that a mastered
section no longer out-ranks an actively-practiced learning section in the
overview suggestions.
