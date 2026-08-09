# Session planner

Tracking issues: [#47](https://github.com/Senth/my-musical-repertoire/issues/47),
[#86](https://github.com/Senth/my-musical-repertoire/issues/86),
[#96](https://github.com/Senth/my-musical-repertoire/issues/96)

## 1. What

`buildPlan` (`utils/session-planner.ts`) turns a `SessionAllocation` — minutes per
block kind, resolved from a preset — plus the user's pieces, sections and
techniques into a `SessionPlan`: an ordered list of `PlannedBlock`s, each with a
target and a fractional minute allocation.

The planner decides **what**, never **how much**. The allocation is the preset's
job ([`session-presets.md`](session-presets.md)); the ranking is
[`planner-scoring.md`](planner-scoring.md)'s. What lives here is: which slots
survive, how a line's minutes become blocks, which candidate each block lands on,
and where minutes go when they cannot be spent.

Every function is `now`-injectable and deterministic: same inputs + same data +
same wall clock → same plan. No randomness.

## 2. Why

Three defects shaped the current design, all of them the same failure — a line's
minutes being dumped somewhere they do no good.

1. **One block per line.** A 20-minute learning line meant 20 minutes on one
   section. Returns on a single learning section die at roughly 10–12 minutes;
   past that you are grinding reps with no new information.
2. **Stabilizing sections inside a learning piece were unreachable.** The
   stabilizing line filtered by `piece.state`, so a `stabilizing`-phase section
   inside a `learning`-state piece could never be picked, and the learning line
   buried it under `PHASE_SCORE`. The student's report — "I'm starting to forget
   what I have learnt" — was that bug.
3. **Maintenance took its best piece at full cost unconditionally.** A 12-minute
   piece turned a requested 30-minute session into 41 with no warning.

### Piece-centric, not section-centric

The first pedagogy recommendation was section-centric: `section.phase` drives
slot assignment and `piece.state` only gates. It was reversed on review. For a
library of 1–2 learning pieces plus a handful of maintenance pieces, the only
stabilizing-phase sections live *inside* the one learning piece, so the
stabilizing line either idles or surfaces them stripped of their piece context
while the learning line grinds a single section — under-review **and**
over-grinding at once. Section-centric only wins for a large repertoire spread
across many phase states.

The model, in words a user reading a preset row can follow:

| Line | Means |
| --- | --- |
| **Learning** | Focused work on your learning-state pieces: new acquisition, plus review of those same pieces' already-learned sections. |
| **Stabilizing** | Cross-piece consolidation: pieces fully promoted out of learning, plus problem sections inside otherwise-maintenance pieces. Never touches a learning-state piece. |
| **Maintenance** | Whole-piece run-throughs. |

Clean partition, no double-counting: promotion out of `learning` is the handoff
that moves a piece from the learning line to the stabilizing line.

### Why the learning line is greedy, not a fixed share

An earlier design reserved `max(3, 0.25·L)` minutes for review. At a ~20-minute
line that produced two 8-minute learning blocks and a 3–4 minute review block,
and two complaints followed, both correct: **4 minutes is not a review** (it is
one pass — a check, not rehearsal), and **the share is structural**, so the split
was identical whether the stabilizing sections were played yesterday or two weeks
ago. Nothing about the plan responded to how practice actually went.

Greedy is safe here only because the *score* provides the back-pressure: every
section accrues `PHASE_SCORE·days` while it waits and resets to zero when picked,
so the line can never lock into all-new or all-review. The steady-state share of
learning blocks is `10·n_L / (10·n_L + 3·n_S)`, always strictly between 0 and 1:

| n_L | n_S | new | review |
| --- | --- | --- | --- |
| 1 | 1 | 77% | 23% |
| 1 | 3 | 53% | 47% |
| 2 | 3 | 69% | 31% |
| 3 | 1 | 91% | 9% |

**Hard thresholds were considered and rejected.** Forcing a review block when a
stabilizing section passes 10 days untouched self-locks: four stabilizing
sections touched once every four sessions at three days apart sit at twelve days
each, so something is always overdue, so every block becomes review and new
acquisition never runs again. A threshold has no back-pressure; a score does.

### Why maintenance is capped rather than funded

Two alternatives were rejected:

- **Shrink the other blocks to pay for maintenance.** Rejected on pedagogy:
  maintenance is the lowest-value slot in a session. Learning a new section beats
  stabilizing one beats a clean run of a polished piece. Cutting learning or
  technique to fund a run-through inverts the priority ladder.
- **Never schedule an oversized piece at all.** Rejected on product: the student
  keeps maintenance pieces specifically to *finish on something simpler* and to
  *make sure every learnt piece stays remembered*. Silently skipping long pieces
  forever defeats both. Surface the choice; do not make it.

A partial run-through is not an option — maintenance trains unbroken performance
continuity, so half a play-through trains nothing maintenance is for. It is
all-or-nothing per piece.

## 3. Data model

**No Firestore collections or rules belong to the planner.** Plans live in
AsyncStorage via `utils/session-storage.ts` and are ephemeral.

One piece field feeds it:

```ts
// models/piece.ts
durationSeconds?: number | null;  // full play-through estimate; null if unknown
```

Set manually in the piece form or captured in-session from a maintenance block's
elapsed time (see [`session-coach.md`](session-coach.md) §5). There is
deliberately no `durationSource` and no playthrough-count field.

`models/session.ts` carries the planner's output types: `PlannedBlock`,
`SessionPlan`, `OmittedSlot`, `MaintenanceOptIn`, and `SessionAllocation`.
`inflationMinutes` and `maintenanceOptIn` are optional so sessions stored before
they existed keep deserializing.

`SessionPlan.totalMinutes` is the **allocated** minutes. The real length is
`planTotalMinutes(plan)` = `totalMinutes + (inflationMinutes ?? 0)`; every screen
showing a real total goes through that helper rather than re-deriving it.

### Fractional minutes

Every allocation is a real number; rounding happens only at display time via
`utils/format-minutes.ts` (`displayMinutes`, `minutesLabelKey`) — which flags a
value approximate (`~4 min`) when rounding moved it and never renders `0 min` for
a block that has time. Timers use real seconds (`allocatedMinutes * 60`), so
fractions cost nothing at runtime.

## 4. Pipeline (`buildPlan`)

1. Compute availability per redistributable slot.
2. Record `OmittedSlot` entries for slots about to be zeroed.
3. `redistributeForAvailability` — proportional empty-content redistribution.
4. Warmup block (from the *original* allocation, never redistributed).
5. Technique blocks.
6. Learning line (emits `repertoire-review` **and** `repertoire-learning`).
7. Stabilizing line.
8. Maintenance pack (cap, opt-in).
9. Sight-reading block.
10. `distributeUpToCaps` over all section blocks, then the sight-reading timer,
    for every minute the lines could not take.
11. Assemble in `CANONICAL_BLOCK_ORDER`.

`usedSectionIds` / `usedPieceIds` / `usedTechniqueIds` thread through every pick,
so nothing is scheduled twice in one session.

### 4.1 Availability and redistribution

| Slot | Available when |
| --- | --- |
| `technique` | ≥1 eligible technique (`active`/`maintenance`, not practised today) |
| `sightReading` | its allocation > 0 — a freeform timer needs no material |
| `repertoireLearning` | `learningLinePool` is non-empty |
| `repertoireStabilizing` | `stabilizingLinePool` is non-empty |
| `repertoireMaintenance` | ≥1 eligible maintenance piece |

Every slot with minutes but no content is zeroed, its minutes pooled, and the
pool spread across the surviving slots **in proportion to their current
allocation**. Shares are exact, so the total is conserved without integer
patching. With no recipients the minutes are dropped and the session runs
shorter.

Worked example — total 30, `tech 10 / read 5 / rep 15`, a 5-minute slot freed:
`tech += (10/30)×5`, `read += (5/30)×5`, `rep += (15/30)×5`.

**Warmup is excluded** from the pass: it keeps its freeform fallback and its
minutes are never redistributed.

This is **build-time only, for empty content**. It does not change what a
user-disabled preset line does (that line simply is not there) and it does not
apply to a runtime **Skip**, which still just ends the session earlier.

Each zeroed slot records an `OmittedSlot` whose reason distinguishes
`practiced-today` from `no-content` — the setup preview uses it to explain where
the minutes went.

### 4.2 Learning line — greedy, piece-anchored

`learningLinePool` builds **one** pool: every section of every `learning`-state
piece, any phase, minus sections practised today or already used. Pieces are
ranked by their best candidate's score, and **every candidate of the top piece
precedes every candidate of the second, regardless of score.**

That hard anchor is what makes review pedagogically meaningful rather than merely
spaced: you warm into the new bars through the ones that precede them, in the
same piece, in the same session. The line moves to the next piece only when the
anchor has no eligible sections left — never because another piece out-scores it.
A piece with no sections contributes one virtual whole-piece candidate at
`learning` phase.

Per-candidate block bounds come from **the phase the candidate landed on**, not
from which half of a split it came from:

```
phase "learning"                     -> [LEARNING_BLOCK_MIN, LEARNING_BLOCK_MAX] = [8, 12]
phase "stabilizing" | "maintenance"  -> [REVIEW_BLOCK_MIN,   REVIEW_BLOCK_MAX]   = [6,  9]
```

Choosing how many blocks:

```
chosen = [ordered[0]]
for i in 1..ordered.length:
    if sumMax(chosen) >= L: break        # anti-fragmentation: only add a block
                                         # when the set cannot legally take the time
    if sumMin(chosen) + min(ordered[i]) > L: break   # legality: every block must
                                                     # still reach its floor
    chosen.push(ordered[i])
```

Distributing the minutes — every block gets its floor, the remainder is spread in
proportion to each block's headroom so all blocks reach their maximum together:

```
base     = sumMin(chosen)
headroom = chosen.map(max - min)
rem      = min(L - base, sum(headroom))
minutes  = chosen.map((c, i) => min(c) + rem · headroom[i] / sum(headroom))
leftover = L - base - rem
```

| L | types | blocks | minutes | leftover |
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
| 33 | L,R,L | 3 | 12 + 9 + 12 | 0 |
| 60 | L,R,L,R,L,R | 6 | 11.43 ×3 + 8.57 ×3 | 0 |

`L` below the first candidate's floor cannot occur through a preset
(`repertoireLearning`'s floor is 8, and redistribution only ever grows a line),
but it is guarded anyway: emit one block of `L` minutes rather than nothing.

Blocks are never allowed to exceed their maximum to absorb leftovers — the
maximum is a pedagogical ceiling, not a rounding target. Whatever is left comes
back as `leftoverMinutes`.

Learning-phase picks emit `repertoire-learning`, stabilizing/maintenance-phase
picks emit `repertoire-review`. `CANONICAL_BLOCK_ORDER` puts review **first**:
retention is measured before working memory is loaded with new acquisition, or
you cannot read what actually held. Within a kind, blocks sort by score desc.

**All-review sessions are allowed.** If two stabilizing sections genuinely
out-score every learning section, that is the correct session — it means you
neglected them, and it self-corrects next session because the reviewed sections
reset to 0 days while the learning section keeps accruing 10/day.

Degradation needs no ladder: the pool is one list and the loop stops when it runs
out. Fewer eligible sections → fewer blocks, each still bounded, leftover
reported. Empty pool → no blocks, the whole line recorded as an `OmittedSlot`.

### 4.3 Stabilizing line

`stabilizingLinePool` = all sections of `stabilizing`-state pieces (any phase),
**plus** `learning`- or `stabilizing`-phase sections inside `maintenance` /
`performance` pieces — the "problem section in an otherwise fine piece" case.
Learning-state pieces are excluded; they belong to the learning line.
Whole-piece candidates from maintenance/performance pieces stay out: run-throughs
are the maintenance line's job, and counting them twice would double-book the
piece.

`splitStabilizingLine(S)` splits evenly: `n = ceil(S / STABILIZING_BLOCK_MAX)`,
each block `S / n`. For the preset's 5..45 range `S / n` is always at least
`STABILIZING_BLOCK_MIN`, so no borrowing is needed.

| S | blocks |
| --- | --- |
| 5 | 5 |
| 12 | 12 |
| 13 | 6.5 ×2 |
| 20 | 10 ×2 |
| 25 | 8.33 ×3 |
| 45 | 11.25 ×4 |

When the pool is thinner than the split asked for, the remaining blocks are
capped at `STABILIZING_BLOCK_MAX` rather than absorbing the whole line, and the
rest is `leftoverMinutes`. There is no anchoring here — the line's job is
cross-piece consolidation, so anchoring would be actively wrong.

Blocks always land on **different sections**: the same section twice with a pause
in the middle is one long block, not interleaving.

### 4.4 Maintenance line — packing, cap, opt-in

Per-piece cost:

```
maintenanceCost(piece) =
  piece.durationSeconds != null ? max(1, (durationSeconds / 60) × 1.2)   // + 20% buffer
                                : 5                                      // flat guess, no buffer
```

The cap applies to the **whole maintenance group**, not per piece — per-piece
capping would let three packed pieces push a session 9 minutes long, which is the
bug being fixed:

```ts
export const MAINTENANCE_INFLATION_CAP_MINUTES = 3;
allowance = budgetMinutes + MAINTENANCE_INFLATION_CAP_MINUTES;
```

Walk the scored pool best-first. Take a piece when `used + cost <= allowance`
(inclusive — a piece landing exactly on the allowance is taken); otherwise
**skip it and keep scanning**. Skip-and-continue is what "pick the next-best
piece that fits" means, and it packs the remaining minutes better than stopping
at the first miss.

- `inflationMinutes = max(0, used − budgetMinutes)`
- `leftoverMinutes = max(0, budgetMinutes − used)`
- `optIn` = the highest-scoring eligible piece that was **not** picked and whose
  own cost exceeds the allowance (i.e. it can never fit, not merely crowded out
  by earlier picks). `null` when the budget is 0 or no such piece exists.

Worked example — budget 8, cap 3, allowance 11; pieces A=6, B=4, C=3:

```
A 6  -> used 6   (<= 11) take
B 4  -> used 10  (<= 11) take
C 3  -> used 13  (>  11) skip
-> maintenance 10 min, inflation 2 min, leftover 0
```

**The opt-in is a swap, not an addition.** `forcedMaintenancePieceId` makes the
named piece the *only* maintenance block at full cost, with `leftoverMinutes = 0`
and `optIn = null`. End-of-session energy is low, so one clean run of one chosen
piece is the right ask; adding the oversized piece on top of the auto-picked
group would turn a 3-minute slot into 17 minutes. If the piece is no longer
eligible the option is ignored and normal packing runs.

Ticking the box **rebuilds the whole plan** rather than patching the maintenance
block — in the no-piece-fits case those minutes had already been handed to the
other lines as leftover, and the rebuild takes them back so the preview stays
honest.

**No maintenance budget → no maintenance block and no opt-in row.** A 15-minute
session is not the place to offer a 14-minute piece.

Every maintenance block has `sectionId: null` — maintenance is whole-piece only,
and the coach renders the whole-piece form for it.

### 4.5 Technique and warmup

Technique count per slot: `count = clamp(floor(slotMin / 5), 1, 3)`, reduced
while any technique would get under 3 minutes. Active/maintenance split:

| Slot minutes | Split |
| --- | --- |
| < 8 | all active |
| 8–14 | 1 maintenance, rest active |
| > 14 | 1 active + 1 maintenance (count 2), 1 active + 2 maintenance (count 3) |

Shortfalls in either sub-pool are backfilled from the other. Minutes divide
exactly (`slotMin / count`). Empty in both pools → no technique blocks, and the
availability pass has already moved the minutes elsewhere.

Warmup picks the longest-not-practised `maintenance` technique (tie-break
`dateIntroduced` asc, then title). With no maintenance techniques the block is
still emitted with no target — a freeform "your choice of scales" timer. Warmup
minutes come straight from the allocation and are never redistributed.

### 4.6 Leftover minutes

`distributeUpToCaps` spreads everything the lines could not take — maintenance
pieces that did not fit, plus learning/stabilizing minutes the block caps refused
— over the section blocks in proportion to their current allocation, never past
each block's `BLOCK_CAP` (the caps are the reason those minutes had nowhere to go
in the first place). Whatever still cannot be placed goes to the sight-reading
timer, which is freeform and can absorb any amount. Beyond that the session
simply runs short, and an `OmittedSlot` explains it.

## 5. UI

The planner has no screens of its own. `SessionPlan` is consumed by the setup
preview, the coach and the summary — see
[`session-coach.md`](session-coach.md), which owns the opt-in checkbox, the
inflated-total row and the multi-line maintenance preview.

## 6. Logging

None. The planner is pure and writes nothing. What each block *logs when
practised* belongs to [`practice-logging.md`](practice-logging.md).

`PlannedBlock.rationale` exists in the model and is unused — the "why this now?"
explanation is [#17](https://github.com/Senth/my-musical-repertoire/issues/17).

## 7. Out of scope

- **Any scoring formula.** Owned by [`planner-scoring.md`](planner-scoring.md).
- **Preempt, cadence or session-history rules** — forced review after N days,
  caps on consecutive all-new sessions, minimum-one-learning-block guarantees.
  Rejected in §2 with the reasoning; do not reintroduce them without new evidence
  from real data.
- **Continuity run-throughs** →
  [#87](https://github.com/Senth/my-musical-repertoire/issues/87). Recorded so
  the issue can be written without re-deriving it: the span is the contiguous run
  of stabilizing-or-better sections from bar 1 up to (not including) the current
  learning section; it lives *inside* the learning line as a mandated sub-block,
  goes **last** in that line, and competes for the same minutes as §4.2's loop;
  5 min for a 2–3 section span, 7 min for 4–5; fires every 4 sessions or on 7-day
  span staleness, whichever comes first; skipped to the next session when it
  cannot fit alongside a full-length new-acquisition block, because new
  acquisition has scheduling priority. Without it you end up with components
  rather than music: memory cueing breaks at seams, seam tempo is wrong on the
  first joined attempt, and phrasing across a section boundary is invisible.
- **BPM-delta decay signal** →
  [#88](https://github.com/Senth/my-musical-repertoire/issues/88).
- **Adaptive per-section review intervals** — needs cold-recall data
  ([#97](https://github.com/Senth/my-musical-repertoire/issues/97)) first.
- **Configurable or dynamic inflation cap.** 3 minutes flat, hardcoded.
- **Partial play-throughs** of an oversized piece, and **more than one opt-in
  row** (only the best-scored non-fitting piece is offered).
- **Persisting the opt-in** across sessions. Deciding fresh each session *is* the
  feature; once the piece is practised its score drops and it re-enters normal
  packing on its own.
- **Runtime-Skip live redistribution** — Skip still just ends the session earlier.
- **Saving sessions to Firestore.** Plans stay ephemeral.
- **`durationSource`** (manual vs measured) and **playthrough counts** — one
  play-through per maintenance piece is assumed.
- **Cross-day maintenance rotation cap** — same-day repeat is already blocked.
- **A heuristic deciding *whether* to schedule maintenance at all** — for now
  always pick ≥1 when eligible.
- **Known gap — freshly promoted maintenance pieces.** A piece just promoted from
  stabilizing still has rough edges and is a poor "finish strong" choice. There is
  no `promotedToMaintenanceAt` field; a future cooldown (~4 sessions) would fix it.
- **Known gap — declined opt-ins are a signal.** Repeatedly ignoring a specific
  piece says something (too hard? wrong session position?). Minimal future
  version: `optInDeclined: boolean` on `BlockExecutionState`.
- **Simultaneous sessions across devices** — last-write-wins, no conflict UI.
