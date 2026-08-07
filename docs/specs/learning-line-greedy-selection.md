# Learning Line: Greedy Selection + Quality-Aware Scoring

# Phase 0: Handoff

- **Spec:** `docs/specs/learning-line-greedy-selection.md` (this file).
- **Tracking issue:** [#96](https://github.com/Senth/my-musical-repertoire/issues/96) — move to
  **In Progress**, then run `scripts/sync-todo.sh`.
- **Implementer:** use the **Phases** section below as the implementation plan. Deliver phases in
  order; each is one sub-agent session. The final phase is full test/lint + playwright E2E.
- **Supersedes** the block-splitting half of
  [`learning-and-review-blocks.md`](learning-and-review-blocks.md) (#86). That spec's candidate
  pools (§5) and block kinds survive; its fixed 25% review share and `splitLearningLine` math
  (§4.1) are deleted. The stabilizing and maintenance lines from #86 are untouched.
- **Follow-up issue created during this design:**
  [#97](https://github.com/Senth/my-musical-repertoire/issues/97) — cold-recall log (rate the
  first uncorrected pass, before repair). Out of scope here.
- After all phases verified, close #96 via PR body `Closes #96` and run `scripts/sync-todo.sh`.

---

## 1. What

Replace the learning line's fixed 25%-review split with a single score-ranked pool: pick the
highest-scoring section of one anchor piece regardless of phase, size each block by the phase it
landed on, and repeat until the allocated minutes are used. Add quality and effort to the section
score so a section you struggled with outranks one you merely played longer ago.

## 2. Why

### The reported defect

The shipped #86 model reserves `max(3, 0.25·L)` minutes for review and gives the rest to
8–12-minute learning blocks. At the reported line length (~19–20 min) that produces **8 + 8
learning and a 3–4 minute review block** (`utils/session-split.ts:95`, pinned in
`utils/session-split.test.ts:92`). Two complaints follow, and both are correct:

1. **4 minutes is not a review.** It is one pass — a check, not rehearsal. The teacher's floor is
   6 minutes: a cold retrieval pass, a repair pass, and a confirming pass over 16–32 bars.
2. **Two new sections every session.** The share is structural, so the split is the same whether
   the stabilizing sections were played yesterday or two weeks ago. Nothing about the plan
   responds to how the practice actually went.

### Why the fix is scoring, not shares

#86 separated the pools because scores were not comparable across phases: `PHASE_SCORE` is
`learning 10 / stabilizing 2.5`, so a learning section wins essentially always. Splitting the
pools worked, but it replaced one rigid answer with another — the share is a constant, and a
constant cannot say "today, review".

The scores are not comparable because of `bpmTerm`. It is **raw BPM, additive, and never decays**
(`utils/planner-scoring.ts:93`). A learning section is far from target by definition, so it
carries a permanent +40 or +50 that no amount of neglect on a stabilizing section can out-wait:

| candidate | days | bpm gap | score under today's formula |
| --- | --- | --- | --- |
| learning section, target 120, at 70 | 1 | 50 | 10 + 50 = **60** |
| stabilizing section, target 120, at 110 | 8 | 10 | 20 + 10 = 30 |
| stabilizing section, same | 17 | 10 | 42.5 + 10 = 52.5 |
| stabilizing section, same | 20 | 10 | 50 + 10 = **60** |

Twenty days of neglect to draw level. Fix the term and the pools no longer need separating.

### What the new score adds

Two things are missing today. **Quality and effort are ignored for learning and stabilizing
sections** — only the maintenance branch uses them — so the planner has no idea how the last
attempt actually went. And the BPM term is unscaled, so it dominates one phase and is silent in
another.

Both are fixed by one formula with per-phase weights (§3.1). The user's framing, kept verbatim
because it is the acceptance test: *a section at 30 bpm with perfect quality and effort should
score less than one at 40 bpm that went badly, even though 40 is closer to target.*

### Why greedy is safe here

Greedy has no structural guarantee that review ever happens, which is exactly the failure #86 was
built to prevent. It is safe now because the score itself provides the back-pressure: every
section accrues `M·days` while it waits, and picking one resets it to zero. The steady-state
share of learning blocks is

```
10·n_L / (10·n_L + 3·n_S)
```

where `n_L` and `n_S` are the counts of eligible learning- and stabilizing-phase sections. It is
always strictly between 0 and 1 — the plan can never lock into all-new or all-review:

| n_L | n_S | new | review |
| --- | --- | --- | --- |
| 1 | 1 | 77% | 23% |
| 1 | 3 | 53% | 47% |
| 2 | 3 | 69% | 31% |
| 3 | 1 | 91% | 9% |

**Hard thresholds were considered and rejected.** The teacher proposed forcing a review block when
a stabilizing section passes 10 days untouched. With one block per session that rule self-locks:
four stabilizing sections touched once every four sessions at three days apart sit at twelve days
each, so something is always overdue, so every block becomes review and new acquisition never runs
again. A threshold has no back-pressure; a score does.

### Piece cohesion

The line concentrates on one **anchor piece** — the piece owning the highest-scoring candidate.
Every further block comes from that piece, and the line moves to the next-best learning piece only
when the anchor has no eligible sections left. Never because another piece out-scores it.

This is what makes the review blocks pedagogically meaningful rather than merely spaced: you warm
into new bars through the ones that precede them, in the same piece, in the same session.
`scorePiece` (`utils/piece-scoring.ts:55`) is already defined as "max section score", so "piece
owning the top candidate" and "highest-scoring piece" are the same thing — no new piece-level
metric is needed.

### Ordering

Review blocks still run **before** learning blocks. The teacher calls this non-negotiable: you
measure retention before working memory is loaded with new acquisition, or you cannot read what
actually held. `CANONICAL_BLOCK_ORDER` already encodes it (`utils/session-planner.ts:43`) — the
pool unifies, the order does not.

## 3. Data model

**No Firestore schema or rules changes.** No new persisted state of any kind: no session-history
counters, no per-piece cadence tracking. Every input already exists on `Section` / `ModeStats`.

### 3.1 New section score

Replaces the phase-branching body of `scoreSectionCandidate` (`utils/planner-scoring.ts:70`).
One formula, no phase branch anywhere:

```ts
needsWork = (5 - quality)² + (effort - 1)²           // 0..32
bpmGap    = max(0, target - currentBpm)              // 0 when either is null
score     = M[phase]·days + N[phase]·bpmGap + P[phase]·needsWork
```

| phase | M (days) | N (bpm gap) | P (needs work) |
| --- | --- | --- | --- |
| learning | 10 | 0.25 | 0.5 |
| stabilizing | 3 | 0.5 | 1 |
| maintenance | 1 | 1 | 1 |

Defaults when unlogged stay as today: `quality ?? 5`, `effort ?? 1` — so `needsWork` is 0 for a
section with no history and the term never inflates an unplayed section.

**Squared, not linear.** A minor slip should be nearly free; a section that fell apart at the limit
should be an emergency. Squaring gives that curve, and `P` is halved from the linear equivalent to
compensate for the range change (0–8 becomes 0–32):

| quality / effort | linear × P | squared × P/2 |
| --- | --- | --- |
| q4 e2 — minor slips, comfortable | 4 | **1** |
| q3 e3 — middling | 8 | 8 |
| q2 e4 — rough, demanding | 14 | 18 |
| q1 e5 — fell apart, at my limit | 16 | **32** |

*(stabilizing column)*

**N rises as the phase matures (0.25 → 0.5 → 1), and that is deliberate.** Learning gaps are large
(~50), stabilizing gaps small (~10), maintenance gaps near zero. The rising weight normalizes the
term into the same 5–13 band for every phase, so BPM is a nudge everywhere instead of dominating
one phase and vanishing from another. It also means a *maintenance* section that has drifted below
tempo is flagged hard — one BPM below target costs a full day of neglect — which is the signal you
want from a section that is supposed to be finished.

Resulting behaviour, target 120, learning section at 70 bpm, stabilizing at 110:

| candidate | score | |
| --- | --- | --- |
| learning, 1d, q3 e4 | 10 + 12.5 + 6.5 = **29** | the baseline |
| learning, 1d, q1 e5 — fell apart | 10 + 12.5 + 16 = **38.5** | repeats it, correct |
| stabilizing, 8d, q4 e2 | 24 + 5 + 2 = **31** | review wins on neglect |
| stabilizing, 3d, q2 e4 — rough | 9 + 5 + 18 = **32** | review wins on struggle |
| stabilizing, 3d, q4 e2 | 9 + 5 + 2 = **16** | recent and fine, skipped |
| maintenance, 14d, q5 e1, on target | 14 + 0 + 0 = **14** | rarely surfaces |
| maintenance, 14d, q5 e1, 8 bpm below | 14 + 8 + 0 = **22** | drift is visible |
| maintenance, 30d, q5 e1, on target | 30 + 0 + 0 = **30** | eventually surfaces |

The crossover — the point where a neglected stabilizing section beats active new acquisition —
lands around **7 days**, or immediately if the last attempt was logged rough.

`daysSince(null)` returning 999 (`utils/planner-scoring.ts:20`) is unchanged and intentional: a
never-practiced section is top priority.

### 3.2 Scope of the scoring change

The new formula is a **global replacement**. `scoreSectionCandidate` has three call sites
(`utils/planner-scoring.ts:122`, `:140`, `:283`) feeding the learning line, the stabilizing line,
`scorePiece`, the overview suggestions, and piece-list sorting. All get the quality/effort signal.
Two consequences to accept knowingly:

- `PHASE_SCORE` stabilizing goes **2.5 → 3**, partially reversing #54
  (`deprioritize-mastered-sections.md`). Deliberate: #54 lowered it to stop mastered sections
  crowding out learning *inside a shared pool*, and the new formula's needs-work term is a better
  instrument for that than a global phase weight.
- The maintenance branch of `scoreSectionCandidate` disappears. `scoreMaintenancePiece`
  (`utils/planner-scoring.ts:158`), which scores *whole pieces* for the maintenance line, is a
  different function and is **not** touched.

### 3.3 Block size constants

`utils/session-split.ts` keeps only the constants and the stabilizing split:

```ts
export const LEARNING_BLOCK_MIN = 8;
export const LEARNING_BLOCK_MAX = 12;
export const REVIEW_BLOCK_MIN = 6;    // was 3 — 4 minutes is a check, not a rehearsal
export const REVIEW_BLOCK_MAX = 9;    // was 8
export const STABILIZING_BLOCK_MIN = 5;   // unchanged
export const STABILIZING_BLOCK_MAX = 12;  // unchanged
```

Deleted: `REVIEW_SHARE`, `REVIEW_TRIGGER_MINUTES`, `splitLearningLine`, `splitReviewMinutes`,
`capLearningMinutes`, and the `LearningLineSplit` interface.

**Why review max is 9, not 8 or 10.** 8 collides with the learning floor, so the planner would
price a review block identically to new acquisition. 10 invites grinding consolidated material —
returns on an already-stabilized section die around 8 minutes, not 12. 9 is 6 core minutes plus 3
for one tempo probe or one flagged-spot repair, and 1.5 × 6 tiles 12–18 cleanly. The ceiling also
carries a rule worth recording even though it is out of scope here: a section that genuinely needs
more than 9 minutes should be **demoted** `stabilizing → learning`, not given a longer block. That
is issue #19's job.

## 4. Selection algorithm

Replaces `pickRepertoireLearningBlocks` (`utils/session-planner.ts:281`). `L` is the allocated
learning minutes, after `redistributeForAvailability`.

### 4.1 Pool and ordering

```
1. candidates = all sections of pieces where state === "learning",
                any phase, minus practicedToday / usedSectionIds / usedPieceIds
                (unchanged from learningLinePools — the two pools merge into one)
2. if empty -> no blocks, leftoverMinutes = L
3. group by piece; rank pieces by their best candidate's score, desc
4. ordered = concat over that piece ranking of each piece's candidates, score desc
```

Step 4 is the hard anchor: every candidate of the top piece precedes every candidate of the
second, regardless of score. A piece with no sections still contributes its existing virtual
whole-piece candidate (phase `learning`) — it is simply a piece with exactly one candidate.

### 4.2 Choosing how many blocks

Per-candidate bounds come from the phase it landed on:

```
phase "learning"                   -> [LEARNING_BLOCK_MIN, LEARNING_BLOCK_MAX] = [8, 12]
phase "stabilizing" | "maintenance" -> [REVIEW_BLOCK_MIN,  REVIEW_BLOCK_MAX]  = [6,  9]
```

```
chosen = [ordered[0]]
i = 1
while sumMax(chosen) < L and i < ordered.length:
    if sumMin(chosen) + min(ordered[i]) > L: break
    chosen.push(ordered[i]); i++
```

The `sumMax(chosen) < L` guard is what prevents fragmentation: a block is only added when the
current set genuinely cannot absorb the time. The `sumMin` guard is what prevents illegal blocks:
a candidate is only added when every chosen block can still reach its floor.

### 4.3 Distributing the minutes

Every block gets its floor; the remainder is spread in proportion to each block's headroom, so all
blocks reach their maximum together.

```
base     = sumMin(chosen)
headroom = chosen.map(max - min)
rem      = min(L - base, sum(headroom))
minutes  = chosen.map((c, i) => min(c) + rem · headroom[i] / sum(headroom))
leftover = L - base - rem
```

Worked table. "Types" is the phase sequence greedy happened to pick:

| L | types | chosen | minutes | leftover |
| --- | --- | --- | --- | --- |
| 8 | L | 1 | 8 | 0 |
| 8 | R | 1 | 8 | 0 |
| 10 | L | 1 | 10 | 0 |
| 11 | L | 1 | 11 | 0 |
| 11 | R | 1 | 9 | 2 |
| 13 | L | 1 (8+6 > 13) | 12 | 1 |
| 14 | L,R | 2 | 8 + 6 | 0 |
| 15 | L,R | 2 | 8.57 + 6.43 | 0 |
| 16 | L,L | 2 | 8 + 8 | 0 |
| 20 | L,L | 2 | 10 + 10 | 0 |
| 20 | L,R | 2 | 11.43 + 8.57 | 0 |
| 24 | L,L | 2 | 12 + 12 | 0 |
| 25 | L,L,L | 3 | 8.33 ×3 | 0 |
| 33 | L,R,L | 3 (max 33) | 12 + 9 + 12 | 0 |
| 60 | L,R,L,R,L,R | 6 | 11.43 ×3 + 8.57 ×3 | 0 |

The four cases from #96 all land as specified: `L=8` one block; `L=11` a single 11-minute learning
block, or a 9-minute review block with 2 minutes returned; `L=15` two blocks; `L=20` two blocks,
either shape.

`L` below the first candidate's floor cannot occur via the preset (`repertoireLearning` floor is 8
and `redistributeForAvailability` only ever grows a line), but guard it anyway: emit one block of
`L` minutes rather than nothing.

### 4.4 Degradation

There is no ladder any more — the pool is one list and the loop stops when it runs out. Three
cases remain:

1. **Fewer eligible sections than the split wanted.** Handled by `i < ordered.length` in §4.2.
   Fewer blocks, each still bounded, leftover reported.
2. **Anchor piece exhausted.** Step 4 of §4.1 already appends the next piece's candidates, so this
   needs no special code.
3. **Pool empty.** No blocks, `leftoverMinutes = L`, and the whole line is recorded as an
   `OmittedSlot`, exactly as today.

**Leftover minutes** reuse the existing machinery unchanged (`utils/session-planner.ts:999`):
`distributeUpToCaps` over the other section blocks, then the sight-reading timer, then an
`OmittedSlot` so the setup preview explains where they went. Blocks are never allowed to exceed
their maximum to absorb leftovers — the maximum is a pedagogical ceiling, not a rounding target.

**All-review sessions are allowed.** #86's rule that review blocks never outnumber learning blocks
is deleted. If two stabilizing sections genuinely out-score every learning section, that is the
correct session — it means you neglected them. It self-corrects the next session: the reviewed
sections reset to 0 days while the learning section keeps accruing 10/day.

## 5. UI flow

Nothing new. The two block kinds survive with their existing labels ("Learning: Review" /
"Learning: New", `i18n/locales/en-US.json`), `CANONICAL_BLOCK_ORDER` is unchanged, the coach's
block switch is unchanged, and the setup preview renders whatever blocks the planner emits — it
already handles a line producing several blocks.

The only visible differences are consequences of the planner: review blocks are now 6–9 minutes
instead of 3–8, a session may contain zero review blocks or zero learning blocks, and every block
in the learning line comes from the same piece unless that piece ran out of sections.

## 6. Logging

**No logging changes.** The feature consumes `quality`, `effort`, `currentBpm` and `lastPracticed`
that per-block logging already writes — it is the first time the planner reads quality and effort
for learning and stabilizing sections at all.

The signal this design wants and does not have is a **cold-recall rating** taken after the first
uncorrected pass, before repair: end-of-block `quality` measures repaired performance, so it
systematically under-reports decay. Filed as
[#97](https://github.com/Senth/my-musical-repertoire/issues/97).

## 7. Out of scope

- **The stabilizing line.** Keeps its even split (`splitStabilizingLine`, 5–12 min blocks) and its
  cross-piece pool. Its job is cross-piece consolidation, so anchoring would be actively wrong
  there. It changes only indirectly, through the reordering the new score produces.
- **The maintenance line.** Entirely unchanged — whole-piece packing, inflation cap, oversized
  opt-in, `scoreMaintenancePiece`.
- **Any preempt, cadence, or session-history rule** — forced review after N days, caps on
  consecutive all-new sessions, minimum-one-learning-block guarantees. Rejected in §2 with the
  reasoning; do not reintroduce them without new evidence from real data.
- **"Why this now" per-block explanation** → [#17](https://github.com/Senth/my-musical-repertoire/issues/17).
- **Promote / demote prompts** (including the >9-minute demotion trigger) →
  [#19](https://github.com/Senth/my-musical-repertoire/issues/19).
- **Cold-recall logging** → [#97](https://github.com/Senth/my-musical-repertoire/issues/97).
- **Continuity run-throughs** → [#87](https://github.com/Senth/my-musical-repertoire/issues/87).
  Note for whoever picks it up: it is not review, it goes **last** in the learning line, and it
  competes for the same minutes as §4.2's loop.
- **BPM-delta decay signal** → [#88](https://github.com/Senth/my-musical-repertoire/issues/88).
- **Relearn self-report flag** → [#89](https://github.com/Senth/my-musical-repertoire/issues/89).
- **Adaptive per-section review intervals** — needs #97's data first.
- **Preset changes.** No new line, slider, or field; no migration.
- **Renaming `section.phase` → `section.state`** — that is #84, independent.

## 8. Phases

**Phase 1 — Scoring formula.**
Rewrite `scoreSectionCandidate` (`utils/planner-scoring.ts:70`) to §3.1: per-phase `M`/`N`/`P`
tables, squared needs-work term, no maintenance branch. Replace `PHASE_SCORE` with the three
weight records (or extend it — implementer's call, but they must be exported and testable
individually). Update `utils/planner-scoring.test.ts` with the §3.1 behaviour table, and pin the
acceptance case explicitly: at target 60, a learning section at 30 bpm with q5/e1 must score
**below** one at 40 bpm with q2/e5. Fix the fallout in `utils/piece-scoring.test.ts`,
`utils/overview-suggestions.test.ts`, `utils/suggestions.test.ts` and
`utils/session-planner.test.ts` — expected numbers change, expected *ordering* mostly should not;
investigate any ordering flip rather than just renumbering it.

**Phase 2 — Split constants.**
In `utils/session-split.ts`: `REVIEW_BLOCK_MIN` 3 → 6, `REVIEW_BLOCK_MAX` 8 → 9. Delete
`REVIEW_SHARE`, `REVIEW_TRIGGER_MINUTES`, `splitLearningLine`, `splitReviewMinutes`,
`capLearningMinutes`, `LearningLineSplit`, and their tests in `utils/session-split.test.ts`.
`splitStabilizingLine` and the stabilizing constants stay. Small phase; it exists so Phase 3's
diff is only the algorithm.

**Phase 3 — Greedy selection with piece anchoring.**
Rewrite `pickRepertoireLearningBlocks` (`utils/session-planner.ts:281`) to §4. Collapse
`learningLinePools` (`:113`) into a single ordered pool with the piece anchoring of §4.1 — keep it
exported and unit-testable. Delete `orderReviewPool` (`:177`); its same-piece-first job is now the
anchor's. Keep `takeDistinct`, `sectionBlock`, `stillAvailable`, and the `usedSectionIds` /
`usedPieceIds` threading. Emit `repertoire-review` for stabilizing/maintenance-phase picks and
`repertoire-learning` for learning-phase ones; `CANONICAL_BLOCK_ORDER` handles the ordering, and
within a kind sort by score desc. Extend `utils/session-planner.test.ts`: every row of §4.3's
table; the anchor rule (a higher-scoring section in a *different* learning piece must not be
picked while the anchor still has eligible sections); anchor exhaustion falling through to the
next piece; an all-review session; the reported bug itself (learning piece, `L = 20`, stabilizing
sections neglected a week → a 6–9 minute review block, never a 3–4 minute one).

**Phase 4 — Wiring and preview.**
Verify `buildPlan` (`utils/session-planner.ts:855`) still consumes the new result shape, that
leftover minutes reach `distributeUpToCaps` → sight-reading → `OmittedSlot` unchanged, and that
`BLOCK_CAP` (`:420`) uses the new `REVIEW_BLOCK_MAX`. Confirm the setup preview
(`app/(app)/session/setup.tsx:186`) and summary (`app/(app)/session/summary.tsx:93`) still produce
unique React keys when the line emits several blocks from one piece — they include `sectionId`, so
distinct sections are fine, but verify. No new i18n keys; check the existing `repertoire-review`
omitted wording still reads correctly now that leftovers come from block caps rather than an empty
review pool.

**Phase 5 — Verify end-to-end.**
Run the full test suite and lint; fix every issue including pre-existing ones. Playwright E2E on
the running app (main: `http://localhost:8081`, worktree: `http://localhost:8082`), logging in
with the test account. Build a preset with a 20-minute learning line and confirm: the preview
shows two blocks; a review block is never shorter than 6 minutes; both blocks come from the same
piece; review runs before new in the coach; each block is separately time-boxed, preselects its
mode, and logs correctly. Then verify the score responds to logging — log a stabilizing section
with low quality and high effort, regenerate the plan, and confirm it climbs the ranking.
