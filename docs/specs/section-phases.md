# Section phases

Tracking issues: [#19](https://github.com/Senth/my-musical-repertoire/issues/19),
[#100](https://github.com/Senth/my-musical-repertoire/issues/100)

## 1. What

How a section's `phase` — `learning` → `stabilizing` → `maintenance` — moves, and
what moves it.

Three mechanisms, in order of how much they assume:

1. **The phase chip** — the always-present manual override, on the piece detail
   row and in the sections panel.
2. **Progression nudges** — after a section block is logged, a one-tap
   **Advance** or **Demote** offer when the logged evidence supports it. The app
   never changes a phase by itself here.
3. **Run-through demotion** — the one *automatic* phase change in the app. A
   whole-piece run-through of a maintenance or performance piece credits the
   sections that held together and demotes the ones the student ticked as shaky.

Plus one related nudge: once a learning piece has no learning-phase sections
left, the app suggests adding the next section.

Every phase change, from any trigger, stamps `phaseChangedAt` and — except for
the section edit form's dropdown — writes an audit row to a `phaseTransitions`
subcollection.

## 2. Why

Phase is the strongest input to the planner: `PHASE_SCORE` is
`learning 10 / stabilizing 3 / maintenance 1`, so a section's phase decides how
often it is scheduled and how long its block is. Before nudges existed, the only
way to move a phase was the chip menu — a lever with no opinion about when to
pull it — so phases drifted stale in both directions. The evidence to decide was
already being logged and thrown away: every section save writes `quality`,
`effort` and `achievedBpm` per hands mode.

### The pedagogy behind the numbers

Advance requires **full mastery** rather than 80–90%, because the phase change
*is* the deprioritisation — advancing early buys nothing (a stabilizing section
still scores its BPM gap) and only moves the last 15% of the tempo work into a
phase where it is harder to do. If the target is genuinely unreachable the fix is
a lower target, not a lower bar.

**Hands-separate must be proven**, because HT at target while LH/RH lag means the
hands are coasting through coordination problems under motor overload and
embedding them as fingering habits — hence `HS_TARGET_MULTIPLIER` (1.15) is
honoured at the learning gate. 95% is enough for stabilizing (the last 5 BPM of a
learning passage is a stabilizing problem) but maintenance gets no discount,
because maintenance means done.

**Demotion is deliberately asymmetric.** Advancing claims a durable state and
needs multi-day evidence; one bad session is enough to *offer* dropping a claim
that is no longer true. A flat "10 BPM drop" trigger was rejected — 10 BPM is
5.5% at target 180 and 17% at target 60, so only the relative form survives.

### Why a run-through writes to sections at all

A maintenance-phase section inside a maintenance- or performance-state piece is
**unreachable by the planner**. The learning line only looks at learning-state
pieces; the stabilizing line takes only learning/stabilizing-phase sections out
of maintenance pieces; the maintenance line schedules whole pieces and never
sections. So those sections were never planned, never logged, and their
`lastPracticed` froze while `daysSince` climbed against a score nothing read.

Meanwhile the one signal that did exist was wired backwards: ticking a section as
bad wrote `lastPracticed = now` to it, resetting `daysSince` to 0 and **lowering**
the score of the exact section that just fell apart.

Both halves of a run-through carry information:

- **Unticked** — the section held together at tempo, in context, under the
  pressure of a continuous play-through. That is genuine maintenance-phase
  practice and it should refresh recency.
- **Ticked** — the section was *revealed* weak, not repaired. A run-through is
  not repair work, so it must not count as practice; and a section that fails in
  performance context is by definition no longer maintained.

Demotion, not a priority flag, is the mechanism. Moving `maintenance` →
`stabilizing` triples the decay rate and puts the section into the stabilizing
line's pool, where it competes on the same formula as everything else. We do not
claim a shaky section matters more than any other stabilizing section — only that
it is no longer maintained. The score handles the rest.

## 3. Nudge criteria

`utils/section-progression.ts` holds the engine; every threshold is an
individually exported constant. `utils/phase-offer.ts` composes it into the one
decision the UI consumes (`decidePhaseOffer`).

### 3.0 Shared definitions

```
effectiveTarget = section.targetBpmOverride ?? piece.targetTempoBpm
hsTargetValue   = hsTarget(effectiveTarget)          // round(1.15 × target)
```

- **Plain modes only.** Every rule reads the non-drill keys `LH` / `RH` / `HT`.
  Drill keys (`HT.staccato`, …) are ignored everywhere — a staccato tempo is not
  the section's tempo, and a deliberate slow drill must never read as decay. A
  log with no `hands` is hands-together by convention, matching `logModeKey`.
- **`effectiveTarget == null` → no offer of any kind.** The BPM criteria are
  unevaluable; the status line (§3.6) says so instead.
- **Tempo is read from `byMode`**, which holds the latest value per mode.
  **Consistency is read from the logs**, the only place multiple sessions exist.

### 3.1 Clean HT days

The consistency criterion, used by both advance gates.

> Take the most recent `N` distinct calendar days on which the section has a
> plain **`HT`** practice log. There must be `N` such days, and **every** `HT`
> log on those days must have `quality >= 4`.

`LH` / `RH` logs are not consulted, and there is **no fallback** when `HT`
history is missing: a section with no `HT` logs cannot advance. Hands-together is
the integration step the transition certifies.

Days are calendar days in the student's local timezone with the 3am cutoff
(`dayKey` in `utils/day-boundary.ts`). The window is whatever
`useLastPracticeLog` returned (`MODE_LOG_LIMIT` = 25); fewer than `N` distinct
`HT` days in that window is **unmet**, conservative by construction. The entries
written by the save in progress are included — `decidePhaseOffer` synthesises
them into logs, so callers pass the fetched history and the saved entries
separately and cannot get the splice wrong.

### 3.2 Advance: learning → stabilizing

Offered when **all** hold:

1. `effectiveTarget != null`
2. `byMode.HT?.bpm != null` and `byMode.HT.bpm >= 0.95 × effectiveTarget`
3. every plain mode **present** in `byMode` clears its own target:
   `LH`/`RH` at `>= hsTargetValue`, `HT` as in (2). A mode never practised is not
   required — but a mode that *has* been practised and lags (or was rated without
   a tempo) blocks the advance.
4. clean HT days with `N = 2` (§3.1)

`isHtReady()` is deliberately **not** reused: it requires both `LH` and `RH` to
be present, which would block an HT-only section that legitimately qualifies.
Rule (3) is "present modes must clear", not "all three modes must exist".

### 3.3 Advance: stabilizing → maintenance

Offered when **all** hold:

1. `effectiveTarget != null`
2. `byMode.HT?.bpm != null` and `byMode.HT.bpm >= effectiveTarget` (100%)
3. clean HT days with `N = 3` (§3.1)
4. **tempo is not sliding** across those 3 days: take the maximum `achievedBpm`
   among the plain `HT` logs of each day (days whose HT logs all have a null
   `achievedBpm` are skipped), and require the sequence oldest → newest to be
   non-decreasing.

Hands-separate is **not** re-checked — it was proven at the previous gate.

### 3.4 Demote

Offered when the section's phase is `stabilizing` or `maintenance` (there is
nothing below `learning`) and **any** of the following is true of the entries
just saved:

- a plain-mode entry with `bpm != null` where
  `bpm < 0.85 × previousBpmForSameMode`, the previous value being the newest
  *earlier* log with the same mode key and a non-null `achievedBpm`. Same mode
  against same mode, always — never HT today against LH last session.
- a plain-mode entry with `quality <= 2`
- a plain-mode entry with `effort == 5` and `quality <= 3`

Target `stabilizing → learning` and `maintenance → stabilizing`. One qualifying
session is enough to *offer*; nothing is ever demoted without a tap. The reasons
are checked in the order listed so the copy quotes the most informative one.

### 3.5 Suppression and the cycling guard

**Dismissal suppression.** Count the section's `phaseTransitions` docs with
`outcome: "dismissed"` and the same `trigger` (`advance-button` or
`demote-button`) written since its most recent `outcome: "accepted"` doc (any
trigger resets the tally). When that count is `>= 3` **and** the newest such
dismissal is less than **7 days** old, the button is not rendered — the status
line appears in its place. After 7 days the offer returns.

Day-based rather than "skip 2 sessions" because nothing in the app counts
sessions in which an offer *would* have fired, and adding such a counter would be
a second source of truth for the same fact.

**Cycling guard.** When `section.phaseChangedAt` is less than **7 days** old, the
offer carries an extra line — "Moved to stabilizing yesterday — change it
again?" — in either direction. A warning, not a block.

### 3.6 Status line

The offer surface shows a passive status line **only** when exactly one criterion
of the relevant transition fails, and when the offer is suppressed under §3.5. A
section further off than that shows nothing — a line that always renders becomes
wallpaper and stops being read.

| Failing criterion | Line |
| --- | --- |
| HT tempo | "Hands together at 112 of 120 BPM" |
| a hands-separate mode | "LH at 108 BPM, needs 138" |
| clean days | "1 of 2 clean sessions" |
| BPM trend (§3.3.4) | "Tempo dipped since last session" |
| suppressed (§3.5) | "Change the phase from the chip when you are ready" |
| `effectiveTarget == null` | "Set a target tempo to track progress" |

The last row renders whenever the target is missing on a learning- or
stabilizing-phase section, regardless of the one-criterion rule — it is
actionable advice, not a progress report.

The status line is a standalone-practice surface only. In the coach the offer is
a modal dialog, and interrupting a session with a modal to report "1 of 2 clean
sessions" would be worse than saying nothing.

## 4. Run-through credit and demotion

`utils/run-through-credit.ts` — `computeRunThroughEffects` is pure; the write is
part of the whole-piece save batch (`useSavePractice`).

Everything below applies **only** when the parent piece's state is `maintenance`
or `performance`, and **only** to sections whose phase is `maintenance`.
Everything else is untouched. Archived sections are never touched.

| `piece.state` | `section.phase` | ticked | effect |
| --- | --- | --- | --- |
| maintenance / performance | maintenance | no | **credit** |
| maintenance / performance | maintenance | yes | **demote** → `stabilizing`, no credit |
| maintenance / performance | stabilizing, learning | either | nothing written |
| learning, stabilizing, on_hold, shelved | any | either | nothing written |

### 4.1 Credit

Written to `byMode.HT` only. A run-through is hands-together by definition and
says nothing about hands-separate work, so `LH`/`RH` are never touched.

```
byMode.HT = {
  lastPracticed: now,                    // always
  bpm:      achievedBpm != null ? max(prev.bpm ?? 0, achievedBpm) : prev.bpm,
  quality:  prev.quality == null
              ? null                     // never invent a rating
              : (max(tech, mem) <= few(1) ? min(5, prev.quality + 1) : prev.quality),
  effort:   prev.effort,                 // unknown from a run-through
}
```

The section's derived fields are then recomputed with `deriveFromByMode`.

Three deliberate conservatisms:

- **BPM never drops.** The stored tempo is earned history from isolated work; a
  run-through taken below it is not evidence the section got slower. A blank
  `achievedBpm` writes nothing.
- **Quality is never invented.** A section that was never rated stays `null`
  (`needsWorkTerm` already treats `null` as quality 5). `prev ?? 3` is *not*
  used — no prior rating means no bump.
- **Quality rises at most one step, and only after a clean run.** One good
  play-through must not erase three bad isolated logs.

Credit is granted regardless of how badly the run went overall. The student
ticked the sections that failed; the rest held up, and that is their word on it.

### 4.2 Same-day exclusion

Credit sets `byMode.HT.lastPracticed = now`, so the per-mode practised-today
filter treats that mode as done. This is correct and needs no new code:

- section with only `HT` → excluded for the rest of the day
- section with `HT` + `LH`/`RH` → still scores on the stale separate-hands modes
- **ticked section** → nothing written → still schedulable for repair in a later
  session the same day

### 4.3 Demotion

`section.phase` is set to `stabilizing`, `phaseChangedAt` is stamped, and a
`run-through` transition doc is written on the same batch. No flag entity, no
history record beyond that. Recovery is the editable phase chip. There is no
automatic promotion back to `maintenance`.

A run-through is a performance context, where failure is unambiguous — which is
why this is the only automatic phase change in the app, and why the
evidence-based nudges (§3) always ask.

### 4.4 Verified invariants

Two properties are already true in the planner and carry regression tests so a
future change cannot quietly break them:

- **Maintenance blocks are whole-piece only** — every `repertoire-maintenance`
  block has `sectionId === null`, so the coach renders the whole-piece form.
- **The stabilizing line scores all three phases** for stabilizing-state pieces
  (no phase filter); only the maintenance/performance branch filters to
  `learning`/`stabilizing`. Demoted sections in stabilizing pieces keep their
  coverage.

## 5. Data model

### 5.1 `Section.phaseChangedAt`

| Field | Type | Notes |
| --- | --- | --- |
| `phaseChangedAt` | `Date \| null` | Written on **every** phase change, from any trigger. Missing reads as null → the cycling guard stays quiet. No backfill. |

Two consumers: the cycling guard (§3.5) and `daysInPriorPhase` on the transition
log.

### 5.2 `Piece.allSectionsAdded`

| Field | Type | Notes |
| --- | --- | --- |
| `allSectionsAdded` | `boolean` | Absent/false by default. True suppresses the add-section nudge for that piece permanently. Editable both ways from the piece edit form. No migration. |

### 5.3 `users/{uid}/pieces/{pieceId}/sections/{sectionId}/phaseTransitions/{id}`

One doc per offer resolution **and** per phase change made from the chip or a
run-through:

```
fromPhase: SectionPhase
toPhase:   SectionPhase          // === fromPhase when outcome is "dismissed"
trigger:   "advance-button" | "demote-button" | "phase-chip" | "run-through"
outcome:   "accepted" | "dismissed"
achievedBpmAtEvent: number | null   // the HT bpm at the time
qualityAtEvent:     number | null
daysInPriorPhase:   number | null   // from phaseChangedAt; null when unknown
sessionId: string | null            // null outside a session
date:      Timestamp
```

`dismissed` docs are the point of the collection: if most advance offers are
dismissed, §3.2's thresholds are too aggressive, and this is the only data that
would ever show it.

Written only on explicit resolution — pressing **Advance**/**Demote**
(`accepted`) or **Not yet** (`dismissed`). Navigating away writes nothing.

The one phase change that writes no transition row is the section edit form's
phase dropdown: it is a field editor, not one of the coached triggers the audit
trail is about. It still stamps `phaseChangedAt`.

### 5.4 `firestore.rules`

The rules enumerate every path explicitly, so the subcollection has its own block
nested inside `match /sections/{sectionId}`:

```
match /phaseTransitions/{transitionId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**Deploy with `yarn deploy:dev`.** An undeployed rule fails every write with
"Missing or insufficient permissions" while the local file looks correct.

### 5.5 Reads and offline

- Log history comes from the existing `useLastPracticeLog` fetch, which also
  returns the raw `logs` window alongside `logsByMode`. `getDocs` serves from the
  Firestore offline cache when disconnected.
- Dismissal counts come from `useSectionPhaseHistory`, a `getDocs` of the newest
  `PHASE_HISTORY_LIMIT` (10) transition docs ordered by `date` desc. Its `reload`
  is called after each resolution.
- All writes go through `awaitWrite`, so they queue offline.
- A phase change and its transition doc are written in **one `writeBatch`**
  (`queuePhaseChange` / `useChangeSectionPhase`) — never a phase change without
  its audit row. The run-through save queues onto the batch it already owns.

## 6. UI

### 6.1 The offer

Evaluated **after** the save commits, never before. In the coach the log form is
on screen while the timer runs, so an in-form button would produce transitions
made on mood rather than on logged evidence.

**Standalone section practice** (the `saved && !inCoach && scopedSection`
branch): `PhaseOfferCard` in `TechniqueLogComparison`'s `beforeActions` slot,
above the Done button.

**Inside the coach**: `PhaseOfferDialog`, rendered by the coach screen after the
save succeeds and **before** `advance("completed")`, mirroring
`DurationPromptDialog`. The block body unmounts on advance, so it leaves the
offer on `CoachContext.phaseOfferRef` and the coach screen resolves it.

Both surfaces share `PhaseOfferBody`:

- Title: "Ready to move this to stabilizing?" / "…to maintenance?" / "Move this
  back to learning?"
- One line of why: "Hands together at 124 BPM, clean for 2 sessions." / "Tempo
  dropped 18% since last session."
- The cycling-guard line when §3.5 applies.
- **Checkboxes, inline** — no second confirm dialog:
  - learning → stabilizing: "I can play this without the score"
  - stabilizing → maintenance: that, plus "It connects cleanly to the section
    before it"
  - demote: none

  Every checkbox shown must be ticked before the Advance button enables. They
  reset when a new offer arrives — the coach reuses one dialog across blocks.
- Actions: **Advance** / **Demote** (primary) and **Not yet**. Both resolve the
  offer and write a `phaseTransitions` doc; in the coach both then advance the
  block.

Only one offer is shown at a time, and demote is checked first. The two can never
both be met — advance needs `quality >= 4` on the latest day, demote needs a bad
entry in the save that just happened.

The memory and continuity checkboxes are self-reported and gate only the tap.
They are not persisted: adding two questions to the form the student fills after
*every* block is the wrong trade for data that matters twice in a section's life.

Note for maintainers: Paper's `Dialog` clones its children to position them, so
`PhaseOfferDialog` returns `null` when there is no offer rather than wrapping its
`Dialog.*` children in a Fragment, which would swallow the injected `style` prop.

### 6.2 `SectionPhaseChip`

The chip is the always-present manual override on the piece detail row and in
`SectionsPracticePanel`. Given an `onChangePhase` prop it becomes pressable and
opens a small menu listing all three phases with the current one marked —
supporting promote **and** demote; without it, it renders as a static chip
(read-only headers).

The menu is **lazy-mounted** (rendered only once opened) to avoid the RN-Paper
Menu web focus-steal bug.

The buttons are contextual nudges that appear and vanish with the evidence; the
chip never moves. They must not look alike — the offer is a card/dialog with copy
and checkboxes, the chip is a chip.

Chip-driven changes go through `useChangeSectionPhase`, so they write
`phaseChangedAt` and a `phase-chip` transition doc. The full phase picker in the
section edit screen is unchanged.

### 6.3 Add-section nudge

`addSectionNudgeSection(piece, sections)` (`utils/add-section-nudge.ts`) returns
the section to name — the furthest along by `order` — or null. A learning piece
**qualifies** when all hold:

- `piece.state === "learning"`
- it has at least one non-archived section
- **no** non-archived section has `phase === "learning"`
- `piece.allSectionsAdded` is not true

It fires when the last learning section reaches **stabilizing**, not maintenance
— the window where there is attention to spare for new material, and where the
learning line's anchor-piece cohesion
([`session-planner.md`](session-planner.md) §4.2) makes A and B reinforce each
other.

**Coach summary**: after the block list, an `AddNextSectionNudge` per qualifying
piece — but only for pieces that appear in `session.plan.blocks`, so the summary
reports on the session just practised rather than auditing the whole library.

**Piece detail**: the same card above the sections list whenever the piece
qualifies.

Copy: "Section {label} is stabilizing — ready to add the next passage of
{piece}?" Actions:

- **Add section** → routes to the new-section form. One tap to the action, never
  a bare dismiss.
- **No more sections** → sets `allSectionsAdded: true`.

**Piece edit** carries an "All sections added" switch, so the flag can be cleared
again.

### 6.4 Run-through feedback

After a whole-piece save that demoted at least one section, a snackbar: "2
sections moved back to stabilizing". Inside the coach the practice content
unmounts the moment the block advances, so the snackbar is rendered by the coach
screen through `CoachContext.notify()`; standalone practice uses a local one.

## 7. Logging

- `phaseTransitions` (§5.3) is the record — accepted and dismissed both.
- Section logs written as run-through credit carry `source: "run-through"`, so
  later analysis can separate "held up in context" from "repaired in isolation"
  without guessing from `triggeredFrom`. Ticked sections get **no** log — there
  are no stats to record.
- The whole-piece log's `flaggedSectionIds` plus the phase change reconstruct a
  demotion event; demotions are not separately logged beyond the transition doc.
- No new per-session log fields. `quality`, `effort` and `achievedBpm` already
  carry everything the criteria read.

## 8. What this does not change

Stated so a reviewer does not go looking:

- **Scoring.** `PHASE_SCORE`, `BPM_GAP_WEIGHT`, `NEEDS_WORK_WEIGHT` and every
  formula in `utils/planner-scoring.ts` are untouched. The phase change itself is
  the whole effect on the planner.
- **Block sizing and the learning line.** Unchanged.
- **Section BPM and history on demotion.** `byMode` and the logs are preserved
  exactly — a demoted section keeps its earned history, and no tempo is
  prescribed.
- **`MODE_LOG_LIMIT` or the log query.** `useLastPracticeLog` returns one extra
  field; it fetches exactly what it did before.

## 9. Out of scope

Deliberately excluded. Each is a separate issue if the need shows up in use:

- **Any automatic phase change from the §3 criteria.** The app nudges; the
  student taps. This is `docs/PROJECT.md`'s student-gated principle and it is not
  negotiable here. The run-through demotion (§4) is the single exception, and it
  is justified by the performance context.
- **Advancing or demoting whole pieces** (`piece.state`), including "the last
  section reached stabilizing, promote the piece", and piece-level
  "maintenance → stabilizing" suggestions in the overview.
- **Any flag entity.** No `openFlag`, no `flagHistory`, no `FLAG_WEIGHT` score
  term. Demotion is the whole mechanism.
- **Cascading demotion.** A ticked `stabilizing`- or `learning`-phase section is
  not demoted further.
- **Automatic promotion back to maintenance**, and any evidence-based criteria
  for it.
- **Undo affordance** for demotion — the editable phase chip is the recovery path.
- **Technical vs memory branching** — different repair prescriptions, focus
  categories, drill suggestions.
- **Per-section severity input.** Severity stays piece-level.
- **Continuity / section-chaining evidence**
  ([#87](https://github.com/Senth/my-musical-repertoire/issues/87)). The
  maintenance gate asks the student instead of measuring it.
- **Cold-recall rating**
  ([#97](https://github.com/Senth/my-musical-repertoire/issues/97)), which would
  make the quality signal a much better input to these criteria.
- **Persisting the memory / continuity answers** as per-session log fields.
- **Adaptive thresholds** driven by the dismissal data. Collect first, tune by
  hand later, automate never unless the data demands it.
- **Demotion below `learning`** or any "relearn" state
  ([#89](https://github.com/Senth/my-musical-repertoire/issues/89)).
- **The >9-minute-block demotion trigger.** Block duration is not evidence about
  a section; the quality/effort signal already covers it.
- **Nudging about techniques.** Sections only — techniques have their own state
  model.
- **Backfilling `phaseChangedAt`** from anything.
- **Renaming `section.phase` → `section.state`** — that is
  [#84](https://github.com/Senth/my-musical-repertoire/issues/84), independent.
