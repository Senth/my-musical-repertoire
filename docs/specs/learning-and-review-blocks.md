# Learning Line Split + Review Blocks

# Phase 0: Handoff

- **Spec:** `docs/specs/learning-and-review-blocks.md` (this file).
- **Tracking issue:** [#86](https://github.com/Senth/my-musical-repertoire/issues/86) — move to
  **In Progress**, then run `scripts/sync-todo.sh`.
- **Implementer:** use the **Phases** section below as the implementation plan. Deliver phases
  in order; each is one sub-agent session. Final phase is full test/lint + playwright E2E.
- **Follow-up issues** (created, all `feature`, all out of scope here):
  - [#87](https://github.com/Senth/my-musical-repertoire/issues/87) — continuity run-throughs
    (play contiguous learned sections as one span). Rules in §7.
  - [#88](https://github.com/Senth/my-musical-repertoire/issues/88) — BPM-delta decay signal.
  - [#89](https://github.com/Senth/my-musical-repertoire/issues/89) — decay self-report:
    "needed to relearn" flag + session-start retrieval prompt.
- After all phases verified, close #86 via PR body `Closes #86` and run `scripts/sync-todo.sh`.

---

## 1. What

Stop the session planner from spending an entire repertoire line on a single section, and make
already-learned sections of the piece you are currently learning actually get practiced — by
splitting the learning and stabilizing lines into multiple time-boxed blocks and reserving a
mandatory share of the learning line for reviewing that piece's already-learned sections.

## 2. Why

Three defects, all confirmed in code, combine into the reported symptom ("I'm starting to
forget what I have learnt"):

1. **Stabilizing sections are unreachable.** `eligibleSectionCandidates`
   (`utils/session-planner.ts:55`) filters by `piece.state === slot`. A section with
   `phase: "stabilizing"` inside a piece with `state: "learning"` can never be picked by the
   stabilizing line, which only sees pieces whose *whole state* is `stabilizing`.
2. **The learning line buries them.** All sections of learning-state pieces compete in one
   pool ranked by `PHASE_SCORE` (`utils/planner-scoring.ts:12`): learning `10`, stabilizing
   `2.5`. A learning-phase section wins essentially always.
3. **One block per line.** `pickRepertoireSection` returns exactly one `PlannedBlock`, so a
   20-minute learning line means 20 minutes on one section.

Pedagogically (piano-practice-teacher review): returns on one learning section die at roughly
10–12 minutes — past that you are grinding reps with no new information. A stabilizing section
needs touching every 2–4 days; 7 days is overdue and two weeks is abandonment. And reviewing
the already-learned measures of the piece you are learning *is part of learning that piece*,
not a separate task — which is why the fix belongs inside the learning line rather than in a
separate slot.

### Model decision: piece-centric, not section-centric

The teacher's first recommendation was section-centric (`section.phase` drives slot assignment,
`piece.state` only gates). It was reversed on review. For this student's library — 1–2 learning
pieces plus a handful of maintenance pieces — section-centric fails: the only stabilizing-phase
sections live *inside* the one learning piece, so the stabilizing line either idles or surfaces
them stripped of their piece context, while the learning line grinds a single section.
Under-review **and** over-grinding. Section-centric only wins for a large repertoire spread
across many phase states.

The chosen model, in words a user reading a preset row can follow:

| Line | Means |
| --- | --- |
| **Learning** | Focused work on your learning-state pieces: new acquisition, plus a mandatory review share spent on those same pieces' already-learned sections. |
| **Stabilizing** | Cross-piece consolidation: pieces fully promoted out of learning, plus problem sections inside otherwise-maintenance pieces. Never touches a learning-state piece. |
| **Maintenance** | Unchanged — whole-piece run-throughs. |

Clean partition, no double-counting: promotion out of `learning` is the handoff that moves a
piece from the learning line to the stabilizing line.

### Resolution of the conflict with `deprioritize-mastered-sections.md` (#54)

#54 deliberately lowered stabilizing's weight `3 → 2.5` so mastered sections would stop
crowding out active learning. #86 asks for the opposite pull. Separating the pools by *block
type* dissolves the conflict without re-flipping anything: learning-phase and stabilizing-phase
sections never compete in the same ranking again. **No scoring formula changes in this
feature.** The teacher's demand that "a stabilizing section at 8 days should beat a learning
section touched yesterday" becomes true by construction — they are ranked in different pools
with separately reserved minutes.

### Block order: review before learning

Review blocks are ordered **before** the learning blocks in the canonical order. The teacher
called review-before-new non-negotiable: you test retention of prior material *before* working
memory is loaded with new acquisition, otherwise you cannot read accurately what actually held.
It also gives the practical warm-in — you arrive at new material through the measures that
precede it.

Each block stays independently time-boxed by the coach, so review running first cannot eat into
learning time.

## 3. Data model

**No Firestore schema or rules changes.** Session plans live in AsyncStorage
(`utils/session-storage.ts`), practice logs never store block kind, and no scoring input
changes.

### New `BlockKind`

```ts
// models/session.ts
export type BlockKind =
  | "warmup"
  | "technique"
  | "sight-reading"
  | "repertoire-review"        // NEW — ordered before learning, see §2
  | "repertoire-learning"
  | "repertoire-stabilizing"
  | "repertoire-maintenance";
```

An in-flight session persisted before the update carries only old kinds, all of which still
exist — no migration needed.

### New planner constants (`utils/session-planner.ts`)

```ts
export const LEARNING_BLOCK_MIN = 8;      // below this you orient and stop
export const LEARNING_BLOCK_MAX = 12;     // returns die past ~12 min on one section
export const REVIEW_SHARE = 0.25;
export const REVIEW_TRIGGER_MINUTES = 11; // below this the line is one learning block
export const REVIEW_BLOCK_MIN = 3;
export const REVIEW_BLOCK_MAX = 8;
export const STABILIZING_BLOCK_MIN = 5;   // matches the preset line floor
export const STABILIZING_BLOCK_MAX = 12;
```

**Presets are unchanged** — no new `PresetLines` field, no slider, no migration. The share is a
constant; the setup preview already shows the resulting blocks before you start.

## 4. Split math

### 4.1 Learning line

Given `L` = allocated learning minutes. All arithmetic is fractional; display rounding stays
the caller's job, exactly as with the existing maintenance packing.

```
1. review  = L < REVIEW_TRIGGER_MINUTES ? 0 : max(REVIEW_BLOCK_MIN, L * REVIEW_SHARE)
   budget  = L - review

2. n = ceil(budget / LEARNING_BLOCK_MAX)          // fewest blocks that respect the cap

3. if n >= 2 and budget / n < LEARNING_BLOCK_MIN:
       borrow    = n * LEARNING_BLOCK_MIN - budget
       available = review - REVIEW_BLOCK_MIN
       if borrow <= available:                    // borrow to make the split legal
           budget += borrow
           review -= borrow
       else:
           n = 1                                  // split is impossible

4. if n == 1 and budget > LEARNING_BLOCK_MAX:     // cap and hand the surplus back
       review += budget - LEARNING_BLOCK_MAX
       budget  = LEARNING_BLOCK_MAX

5. learning blocks: n blocks of budget / n each
   review blocks:   min(ceil(review / REVIEW_BLOCK_MAX), n) blocks, review split evenly
```

Step 5's `min(..., n)` enforces the teacher's rule that review blocks must never outnumber
learning blocks — spaced repetition is about frequency, not dominance.

Worked table (pin these in tests):

| `L` | Learning blocks | Review blocks |
| --- | --- | --- |
| 8 | 8 | — |
| 10 | 10 | — |
| 11 | 8 | 3 |
| 13 | 9.75 | 3.25 |
| 15 | 11.25 | 3.75 |
| 16 | 12 | 4 |
| 17 | 12 | 5 |
| 18 | 12 | 6 |
| 19 | 8 + 8 | 3 |
| 20 | 8 + 8 | 4 |
| 24 | 9 + 9 | 6 |
| 30 | 11.25 ×2 | 7.5 |
| 40 | 10 ×3 | 5 + 5 |
| 45 | 11.25 ×3 | 5.625 + 5.625 |
| 60 | 11.25 ×4 | 7.5 + 7.5 |

The 18 → 19 step is not monotonic in review minutes (6 → 3): at 19 the budget can just afford
two legal 8-minute learning blocks by borrowing down to the review floor, and two learning
blocks on different sections is worth more than three extra review minutes. Intended; pin it in
a test so nobody "fixes" it later.

### 4.2 Stabilizing line

Given `S` = allocated stabilizing minutes. No review share — the whole line is consolidation
already.

```
n = ceil(S / STABILIZING_BLOCK_MAX)
S / n is always >= STABILIZING_BLOCK_MIN for the preset's 5..45 range, so no borrowing is needed
```

| `S` | Blocks |
| --- | --- |
| 5 | 5 |
| 8 | 8 |
| 12 | 12 |
| 13 | 6.5 ×2 |
| 15 | 7.5 ×2 |
| 20 | 10 ×2 |
| 25 | 8.33 ×3 |
| 45 | 11.25 ×4 |

## 5. Candidate pools

Every pool keeps the existing exclusions: sections practiced today (per-mode, via
`practicedToday`) and sections/pieces already used by an earlier block in the same session
(`usedSectionIds` / `usedPieceIds`). Pieces in `on_hold` and `shelved` never participate.

### Learning line — pieces where `state === "learning"` only

- **Learning pool:** their sections with `phase === "learning"`, plus the existing virtual
  whole-piece candidate for a piece with no sections (already `learning` phase — unchanged).
- **Review pool:** their sections with `phase` in `{stabilizing, maintenance}`, ordered by:
  1. sections of the *same piece* a learning block was picked from — this is the whole point,
     you warm into new material through what precedes it;
  2. then sections of other learning-state pieces;
  3. within each group, by the existing score (unchanged formulas).

### Stabilizing line

- all sections of pieces where `state === "stabilizing"` (any phase), **plus**
- sections with `phase` in `{stabilizing, learning}` inside pieces where `state` is
  `maintenance` or `performance` — the "problem section in an otherwise fine piece" case.
- Learning-state pieces are excluded; they belong to the learning line.

### Maintenance line

Unchanged: whole-piece packing, inflation cap, oversized opt-in.

## 6. Degradation ladder

Blocks must land on **different sections** — the teacher was explicit that the same section
twice with a pause in the middle is just one long block, not interleaving.

When the split asks for more learning blocks than there are distinct eligible learning
sections:

1. another learning-phase section of the same piece;
2. a learning-phase section of another learning-state piece;
3. otherwise reduce `n`, cap each learning block at `LEARNING_BLOCK_MAX`, and move the surplus
   minutes into the review budget (re-running step 5 of §4.1, so review blocks still never
   outnumber learning blocks). This is what guarantees the reported bug cannot recur: with one
   eligible section and `L = 20`, the plan is **12 min learning + 8 min review**, never 20
   minutes on one section.

When the review pool is empty too (brand-new piece with no learned sections, or everything
practiced today):

4. review minutes go back to learning, still capped at `LEARNING_BLOCK_MAX` per block;
5. any remainder that still cannot be placed is redistributed across the other planned blocks,
   and an `OmittedSlot` entry records it so the setup preview explains where the minutes went.
   Reuse the existing `OmittedSlot` shape (`kind: "repertoire-learning"`, existing reasons).

Note one consequence of the "review never outnumbers learning" rule: in the ladder-step-3 case
above the 8 review minutes become a *single* 8-minute review block, not two 4-minute ones,
because there is only one learning block.

## 7. Out of scope

- **Any scoring formula change.** `PHASE_SCORE`, `scoreSectionCandidate` and
  `scoreMaintenancePiece` are untouched — §2 explains why separating pools makes reweighting
  unnecessary.
- **Continuity run-throughs** → follow-up issue. The teacher's rules, recorded so the issue can
  be written without re-deriving them: span = the contiguous run of stabilizing-or-better
  sections from bar 1 up to (not including) the current learning section; lives *inside* the
  learning line as a mandated sub-block; 5 min for a 2–3 section span, 7 min for 4–5; fires
  every 4 sessions or on 7-day span staleness, whichever comes first; skipped to the next
  session when it cannot fit alongside a full-length new-acquisition block, because new
  acquisition has scheduling priority. Without it you end up with components rather than music:
  memory cueing breaks at seams, seam tempo is wrong on first joined attempt, and phrasing
  across a section boundary is invisible.
- **BPM-delta decay signal** → follow-up issue.
- **"Needed to relearn" flag and session-start retrieval prompt** → one combined follow-up
  issue.
- **Spaced-repetition due dates / intervals** and a 7-day overdue flag — considered and
  rejected for this feature; the structural review share addresses the decay without them.
- **Per-preset review-share slider or toggle** — constant for now.
- **Renaming `section.phase` → `section.state`** — that is issue #84, independent.
- **Reordering any line other than the new review block.** Warmup → sight-reading → technique →
  repertoire stays as it is; only the new `repertoire-review` block is inserted (before
  learning, §2).

## 8. Phases

**Phase 1 — Split math (pure functions + tests).**
Add the constants and two pure functions to `utils/session-planner.ts` (or a new
`utils/session-split.ts` if that reads better): `splitLearningLine(L)` returning
`{ learningMinutes: number[], reviewMinutes: number[] }` and `splitStabilizingLine(S)`
returning `number[]`. Implement §4 exactly, including the non-monotonic 18→19 step and the
`min(..., n)` review-block cap. Unit-test every row of both tables plus the boundaries (0, the
preset floors 8/5, the preset maxes 60/45). Pure arithmetic, no planner wiring yet.

**Phase 2 — Candidate pools and block picking.**
Rework `eligibleSectionCandidates` and `pickRepertoireSection` in `utils/session-planner.ts`
into pools per §5 and multi-block picking per §4 and §6: learning-state pieces feed the
learning and review pools; the stabilizing line gets its widened pool and its own split;
distinct sections per block; same-piece-first ordering for review; the full degradation ladder
including leftover redistribution and `OmittedSlot` entries. Thread `usedSectionIds` /
`usedPieceIds` through every new pick so nothing is scheduled twice in one session. Extend
`utils/session-planner.test.ts` — cover the reported bug directly (a learning piece with one
learning section and several stabilizing sections, `L = 20`, asserting 12 + 8 and not 20) and
the previously-unreachable case (a stabilizing-phase section inside a learning-state piece now
appears in a review block).

**Phase 3 — `repertoire-review` block kind and UI wiring.**
Add the kind to `models/session.ts` and to `CANONICAL_BLOCK_ORDER` **before**
`repertoire-learning` (§2). Add the `repertoire-review` case alongside
`repertoire-learning` / `repertoire-stabilizing` in the coach's block switch
(`app/(app)/session/coach.tsx:311`) — it is an ordinary section-practice block. Add i18n keys
in `i18n/locales/en-US.json`: `screen.session.block.repertoire-review` ("Review") and the
matching omitted-reason strings next to the existing `repertoire-learning` /
`repertoire-stabilizing` entries. Check the setup preview and summary block keys
(`app/(app)/session/setup.tsx:186`, `app/(app)/session/summary.tsx:93`) still produce unique
React keys now that one line emits several blocks — they include `sectionId`, so distinct
sections are fine, but verify.

**Phase 4 — Verify end-to-end.**
Run the full test suite and lint; fix every issue including pre-existing ones. Playwright E2E
on the running app (main: `http://localhost:8081`, worktree: `http://localhost:8082`), logging
in with the test account: build a preset with a 20-minute learning line, confirm the setup
preview shows two learning blocks plus a review block (or 12 + 8 if only one learning section
is eligible), run the session in the coach and confirm each block is separately time-boxed,
lands on a different section, preselects its mode, and logs correctly. Confirm a stabilizing
section inside a learning piece is actually offered — the defect that started this.
