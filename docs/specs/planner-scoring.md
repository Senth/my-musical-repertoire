# Planner scoring and overview suggestions

Tracking issues: [#54](https://github.com/Senth/my-musical-repertoire/issues/54),
[#96](https://github.com/Senth/my-musical-repertoire/issues/96)

## 1. What

One scoring module — `utils/planner-scoring.ts` — answers "how badly does this
need practising?" for a section, a whole piece and a technique. Every surface
that ranks anything consumes it: the session planner's candidate pools, the
Overview suggestion lists, and the pieces/techniques list sorts. There is no
second formula anywhere.

`utils/piece-scoring.ts` boils a piece down to one number on top of it, and
`utils/overview-suggestions.ts` turns scores into the Overview cards plus a
one-line reason for each.

## 2. Why

Two surfaces used to disagree. The Overview sorted by ad-hoc recency + mistakes
while the planner used a richer formula, so the app's own recommendation
contradicted itself depending on where the student looked. Extracting one module
means they cannot drift.

The formula itself went through two corrections worth recording, because both are
easy to re-break.

### Mastered material was crowding out active learning

The observed bug: while grinding a hard learning section daily, the engine kept
re-suggesting an already-mastered section in the same piece. The `days` term is
unbounded, so a stale low-phase section eventually overtakes a freshly-practised
learning one. **Unbounded days were kept deliberately** — mastered items should
still rise over time, never silently decay — and the fix went into the weights
and into replacing the tempo-gap term with signals that actually indicate a
mastered item needs attention.

### Scores were not comparable across phases

`bpmTerm` used to be **raw BPM, additive, and never decaying**. A learning
section is far from target by definition, so it carried a permanent +40 or +50
that no amount of neglect on a stabilizing section could out-wait:

| candidate | days | bpm gap | score under the old formula |
| --- | --- | --- | --- |
| learning section, target 120, at 70 | 1 | 50 | 10 + 50 = **60** |
| stabilizing section, target 120, at 110 | 8 | 10 | 20 + 10 = 30 |
| stabilizing section, same | 20 | 10 | 50 + 10 = **60** |

Twenty days of neglect to draw level. That incomparability is why the learning
line once had to keep separate pools with a reserved review share; fixing the
term is what let the pools merge (see
[`session-planner.md`](session-planner.md) §4.2).

Two things were also simply missing: **quality and effort were ignored for
learning and stabilizing sections** — only the maintenance branch used them — so
the planner had no idea how the last attempt actually went. The user's framing is
the acceptance test, kept verbatim: *a section at 30 bpm with perfect quality and
effort should score less than one at 40 bpm that went badly, even though 40 is
closer to target.*

## 3. The section score

One formula, no phase branch anywhere:

```ts
needsWork = (5 - quality)² + (effort - 1)²      // 0..32
bpmGap    = max(0, target - currentBpm)         // 0 when either is null
score     = PHASE_SCORE[phase]·days
          + BPM_GAP_WEIGHT[phase]·bpmGap
          + NEEDS_WORK_WEIGHT[phase]·needsWork
```

| phase | `PHASE_SCORE` (M, per day) | `BPM_GAP_WEIGHT` (N) | `NEEDS_WORK_WEIGHT` (P) |
| --- | --- | --- | --- |
| learning | 10 | 0.25 | 0.5 |
| stabilizing | 3 | 0.5 | 1 |
| maintenance | 1 | 1 | 1 |

Defaults when unlogged: `quality ?? 5`, `effort ?? 1`, so `needsWork` is 0 for a
section with no history and the term never inflates something never played.
`daysSince(null)` returns **999** — a never-practised item is top priority, and
that is intentional everywhere it appears.

**Squared, not linear.** A minor slip should be nearly free; a section that fell
apart at the limit should be an emergency. `P` is halved from the linear
equivalent to compensate for the range change (0–8 becomes 0–32):

| quality / effort | linear × P | squared × P/2 |
| --- | --- | --- |
| q4 e2 — minor slips, comfortable | 4 | **1** |
| q3 e3 — middling | 8 | 8 |
| q2 e4 — rough, demanding | 14 | 18 |
| q1 e5 — fell apart, at my limit | 16 | **32** |

*(stabilizing column)*

**N rises as the phase matures (0.25 → 0.5 → 1), and that is deliberate.**
Learning gaps are large (~50), stabilizing gaps small (~10), maintenance gaps near
zero. The rising weight normalizes the term into the same 5–13 band for every
phase, so BPM is a nudge everywhere instead of dominating one phase and vanishing
from another. It also means a *maintenance* section that has drifted below tempo
is flagged hard — one BPM below target costs a full day of neglect — which is
exactly the signal you want from a section that is supposed to be finished.

Resulting behaviour at target 120, learning section at 70 bpm, stabilizing at 110:

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

The crossover — where a neglected stabilizing section beats active new
acquisition — lands around **7 days**, or immediately if the last attempt was
logged rough.

### 3.1 Per-mode scoring

Sections and techniques record stats **per hands/drill mode**
([`practice-logging.md`](practice-logging.md)), so scoring is per mode too:

- `scoreSectionModes` scores **every mode present in `byMode`** with that mode's
  own `bpm`, `quality`, `effort` and `lastPracticed`, and keeps the **maximum**,
  recording which `modeKey` won. The winner rides on `PlannedBlock.modeKey` so
  the coach preselects the hand that drove the pick.
- `bpmGap` measures against `targetForMode(hands, effectiveTarget)`, so `LH`/`RH`
  (and their drill variants) are judged against the hands-separate target
  (×`HS_TARGET_MULTIPLIER`).
- **Modes absent from `byMode` are not scored.** Otherwise `daysSince(null) = 999`
  would make every maintenance section with an unplayed left hand outrank the
  entire board.
- **Drill modes are scored**, against the same target as their hands mode.
  Staccato genuinely needs to reach target, and the gap converges as the student
  improves.
- The practised-today filter is **per mode**: a section drilled LH this morning
  can come back for RH this afternoon. An item drops out entirely only when every
  present mode was practised today.
- Empty or absent `byMode` falls back to a single pseudo-mode built from the
  item-level fields, scored against the rolled-up slowest-hands tempo.
- For techniques, `reachableByMode` drops stats for modes the technique no longer
  offers (`HT` after a switch to `separate`, a drill key after the drill is turned
  off). A mode the student cannot select must not drive the plan, nor keep a
  technique eligible after every reachable mode was practised today.

`effectiveTarget` for a section is `section.targetBpmOverride ??
piece.targetTempoBpm`.

## 4. The maintenance-piece score

`scoreMaintenancePiece` ranks **whole pieces** in `maintenance` / `performance`
state for the maintenance line. It is a different function from the section score
and does not share its terms:

```
score = stateWeight · days + 2 · (techMistakes + memMistakes)

stateWeight = 3 (performance) | 1 (maintenance)
techMistakes = piece.lastTechnicalMistakes ?? none(0)
memMistakes  = piece.lastMemoryMistakes    ?? none(0)
```

`PracticeMistakes` is `none=0 … everywhere=4`, so the mistakes term ranges 0–16.
`bpmGap` is deliberately **absent**: a one-off slow run on a mastered piece should
not flag it, whereas genuine mistakes should.

## 5. The technique score

```
score = stateScore · days + 2 · ((effort - 1) + (5 - quality))

stateScore = 10 (active) | 2 (maintenance)
```

Defaults `effort ?? 1`, `quality ?? 5` make missing data contribute 0.
`sortTechniques` ranks by score desc, tie-breaking on `dateIntroduced` asc then
title. `retired` techniques never enter any pool.

## 6. The piece score

`utils/piece-scoring.ts` is the single place a piece becomes one number, so a
piece that tops the Overview cannot sit halfway down a score-sorted list:

```
scorePiece(piece, sectionsForPiece, now)
  sections present -> max(scoreSectionModes(...)) over non-archived sections
  no sections      -> scoreMaintenancePiece(piece, now)
```

`hooks/use-piece-scores.ts` computes `Record<pieceId, number>` for the whole
library, memoized in memory and persisted to `piece-scores:<uid>` so a cold open
can sort immediately, before the section listeners have delivered. It recomputes
when pieces/sections change **and** (`max(lastPracticed) > computedAt` **or**
`now - computedAt > 30 min`) — practice is the only thing that meaningfully moves
a score.

A piece with no sections is planned as **one whole-piece candidate at `learning`
phase**, using `piece.lastPracticed` and `piece.lastAchievedTempoBpm`.

## 7. Overview suggestions

`utils/overview-suggestions.ts` renders one flat list per section — no
per-category sub-headers, because the cards already carry a chip.

### Pieces are suggested as passages

Order: Learning → Stabilizing → Performance → Maintenance, by score within each.
Caps (not fixed counts; empty categories are silently omitted): **2** per
category.

Learning and stabilizing pieces are suggested **by section**. The card names the
passage, chips the *section's* phase, and its Practice button opens that section
in the hand that scored it. One piece may hold more than one card. Performance
and maintenance stay whole-piece via `scoreMaintenancePiece` and keep the piece's
lifecycle chip — they have no section to name.

They used to be collapsed to one card per piece. `sectionBasedSuggestions` built
the full `SectionCandidate` — phase, mode, BPM gap, the lot — and
`bestCandidateByPiece` threw the section away, so the card that reached the
student read "Chopin Op. 10/4", which as an instruction means *play the whole
étude*: a twenty-two-minute job, when the app knew perfectly well it meant bars
33–40. The "only one thing per piece" rule that collapse implied was never
pedagogy, only de-duplication mistaken for it — the coach never had it, because
`stillAvailable` dedupes on `usedSectionIds` and several sections of one piece
already share a session.

A stabilizing piece can hold a learning section, and it is the learning section
that put the card on screen; chipping the piece's lifecycle state there would
tell the student to run that passage at tempo.

`on_hold` and `shelved` pieces are filtered out first. Whole-piece suggestions
then drop pieces practised today, but **section suggestions filter per
candidate** (`candidate.practicedToday`), so a passage drilled left hand at 08:00
comes back at 19:00 for the right.

Empty states, checked before scoring except the second:

| Condition | Message |
| --- | --- |
| no pieces at all | "Start by adding a piece to your repertoire." |
| no candidate survives, yet active pieces exist | "Wow! You have practiced all your pieces today. Take a rest or add new pieces to practice!" |
| every active piece is maintenance/performance | "All your pieces are in maintenance. Consider adding a new piece to learn!" |

### Breadth before depth

`breadthFirst` fills each cap in rounds: pass one takes every piece's best
candidate in score order, pass two spends what is left on second passages of
pieces already shown.

Sorting purely by score is the smaller code and the wrong behaviour. Every
unpractised section of a learning piece accrues 10/day on its own, so a finely
sectioned piece out-scores a coarsely sectioned neighbour for as long as it has
untouched sections: a Ligeti in six sections takes both learning slots for three
or four days while the Kurtág vanishes from the day's list. It self-corrects, but
the lag scales with how finely the student happened to section the piece, which
is the wrong thing for a daily menu to depend on. The coverage the old collapse
provided by accident is now deliberate.

**The coach disagrees on purpose.** `learningLinePool` orders *every* candidate
of the top piece ahead of the second piece's, so you warm into new bars through
the ones before them in one sitting. That is depth, and it is right inside a
session. The Overview is a menu across the whole repertoire, and its job is
breadth.

### The card

| Slot | Section card | Whole-piece card |
| --- | --- | --- |
| Title | `piece.title` | `piece.title` |
| Subtitle | `Composer · Bars 33–40` | `piece.composer` |
| Chip and accent stripe | `section.phase` | `piece.state` |
| Reason | winning mode's stats, hand named | piece stats |
| Practice | `?sectionId=…&mode=…&from=overview` | `?from=overview` |

The subtitle reuses the `·` idiom `formatComposerLine` already establishes, and
`formatBarRange` (`utils/piece-display.ts`) formats the range. A section with no
bar range falls back to `section.label`: a bare `B` is poor vocabulary, but
dropping it makes two cards for one piece identical at arm's length, and being
tellable apart matters more than reading well.

**No suggestion card shows a section count**, whole-piece ones included. On a card
naming one passage it reads as three things to do; on a maintenance card it is
decoration. The `piece.sectionCount` string still exists — the pieces list uses
it.

The `mode` param is what makes "opens the hand that scored it" true; without it
the practice screen re-picks through the BPM-gap heuristic and can land on a
different hand than the card named. See
[`practice-logging.md`](practice-logging.md) §5.

### Techniques

Same flat list, caps of **2** active and **2** maintenance, `retired` excluded,
practised-today excluded. Empty state distinguishes "no techniques at all" (show
nothing) from "all practised today".

### Reason text

Each card carries a reason line as an i18n key plus params, computed alongside the
score rather than derived from the model in the component. The reason **recomputes
the score's own terms and names whichever contributed most**, so it can never
claim something the ranking did not do:

| Case | Key |
| --- | --- |
| never practised | `pieceReason.neverPracticed` |
| needs-work term dominates | `pieceReason.lastResultPoor` |
| BPM term dominates | `pieceReason.bpmGap` (with `{{gap}}`) |
| otherwise | `pieceReason.daysSince` (with `{{days}}`) |

For maintenance pieces the comparison is the mistakes term against
`stateWeight · days` → `pieceReason.mistakes` or `pieceReason.daysSince`.
Techniques get never-practised / effort-or-quality / days-since.

For a section, `reasonForCandidate` reads **`section.byMode[candidate.modeKey]`**
— the very entry `scoreSectionModes` scored — and measures the gap against
`targetForMode(hands, effectiveTarget)`. It used to read the section rollup, and
the piece-level practised-today filter hid the disagreement, because a section
touched today never came back. Per-mode filtering exposes it: a passage drilled
left hand in the morning returns in the evening and, on the rollup, would have
said "0 day(s) since last practice". Advice a student cannot audit is advice they
stop following.

The reason line therefore **names the hand** on every card a mode scored, as
`pieceReason.withMode` — `{{mode}} · {{reason}}`, with `modeLabelLong` yielding
Left hand / Right hand / Hands together. It wraps the five reason keys rather than
duplicating each. Naming it on every such card and not only the ambiguous ones is
the point: wording that changes with state the student cannot see is its own kind
of unauditable, and without the hand a same-day return reads as the app having
forgotten what was just logged.

Because the reason mirrors the formula, **any weight change here must be
re-checked against `reasonForCandidate` and `reasonForMaintenancePiece`.**

## 8. Logging

None. Every input already exists and is already written by practice logging:

| Signal | Field | Written by |
| --- | --- | --- |
| Section per-mode stats | `Section.byMode[key]` | `useSaveSectionPractice` |
| Section rollups | `Section.lastQuality` / `lastEffort` / `lastPracticed` | `useSaveSectionPractice` |
| Piece mistakes | `Piece.lastTechnicalMistakes` / `lastMemoryMistakes` | `useSavePractice` |
| Technique per-mode stats | `TechniqueItem.byMode[key]` | `useSaveTechniqueLog` |

The signal this design wants and does not have is a **cold-recall rating**, taken
after the first uncorrected pass and before repair: end-of-block `quality`
measures repaired performance, so it systematically under-reports decay. Filed as
[#97](https://github.com/Senth/my-musical-repertoire/issues/97).

## 9. Out of scope

- **Per-phase day caps.** Unbounded days is a deliberate choice (§2).
- **Auto-promotion or auto-demotion from these scores.** Phase changes are
  student-gated — see [`section-phases.md`](section-phases.md).
- **Showing the score as a number, or filtering by it.** "Score 47" means nothing
  to a student; order carries the message. Sorting by it is fine.
- **Session-duration awareness in the Overview** — it shows all suggestions
  regardless of how long they would take.
- **Per-category sub-headers** in the Overview lists.
- **BPM-bump suggestions**, deadline / priority flags on pieces.
- **The >9-minute-block demotion trigger.** Block duration is not evidence about
  a section; the quality/effort term already covers it.
