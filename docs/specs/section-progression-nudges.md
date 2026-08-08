# Section progression nudges

Tracking issue: [#19](https://github.com/Senth/my-musical-repertoire/issues/19)

## 1. What

After a section practice block is logged, the app offers a one-tap **Advance**
(learning → stabilizing → maintenance) or **Demote** (maintenance → stabilizing
→ learning) when the logged evidence supports it — and, once a learning piece has
no learning-phase sections left, nudges the student to add the next section of
that piece.

Both are nudges. The app never changes a phase by itself.

## 2. Why

Phase is the strongest input to the planner: `PHASE_SCORE` is
`learning 10 / stabilizing 3 / maintenance 1`, so a section's phase decides how
often it is scheduled and how long its block is. Before this, the only way to
move a phase was the `SectionPhaseChip` menu — a lever with no opinion about when
to pull it — so phases drifted stale in both directions. The evidence to decide
was already being logged and thrown away: every section save writes `quality`,
`effort` and `achievedBpm` per hands mode, and the practice screen fetched the
last 25 logs only to keep the newest per mode.

**The pedagogy behind the numbers.** Advance requires full mastery rather than
80–90%, because the phase change *is* the deprioritisation — advancing early buys
nothing (a stabilizing section still scores its `bpmGap`) and only moves the last
15% of the tempo work into a phase where it is harder to do; if the target is
genuinely unreachable the fix is a lower target, not a lower bar. Hands-separate
must be proven, because HT at target while LH/RH lag means the hands are coasting
through coordination problems under motor overload and embedding them as
fingering habits — hence `HS_TARGET_MULTIPLIER` (1.15) is honoured at the
learning gate. 95% is enough for stabilizing (the last 5 BPM of a learning
passage is a stabilizing problem) but maintenance gets no discount, because
maintenance means done. Demotion is deliberately asymmetric: advancing claims a
durable state and needs multi-day evidence, while one bad session is enough to
*offer* dropping a claim that is no longer true. A flat "10 BPM drop" trigger was
rejected — 10 BPM is 5.5% at target 180 and 17% at target 60, so only the
relative form survives.

## 3. Criteria

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

The run-through auto-demotion
(`docs/specs/run-through-credit-and-demotion.md`) is untouched and remains the
only automatic phase change in the app; a run-through is a performance context,
where failure is unambiguous.

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

## 4. Data model

### 4.1 `Section` — `phaseChangedAt`

| Field | Type | Notes |
| --- | --- | --- |
| `phaseChangedAt` | `Date \| null` | Written on **every** phase change, from any trigger. Missing reads as null → the cycling guard stays quiet. No backfill. |

Two consumers: the cycling guard (§3.5) and `daysInPriorPhase` on the transition
log.

### 4.2 `Piece` — `allSectionsAdded`

| Field | Type | Notes |
| --- | --- | --- |
| `allSectionsAdded` | `boolean` | Absent/false by default. True suppresses the add-section nudge for that piece permanently. Editable both ways from the piece edit form. No migration. |

### 4.3 `users/{uid}/pieces/{pieceId}/sections/{sectionId}/phaseTransitions/{id}`

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

### 4.4 `firestore.rules`

The rules enumerate every path explicitly, so the subcollection has its own block
nested inside `match /sections/{sectionId}`:

```
match /phaseTransitions/{transitionId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**Deploy with `yarn deploy:dev`.** An undeployed rule fails every write with
"Missing or insufficient permissions" while the local file looks correct.

### 4.5 Reads and offline

- Log history comes from the existing `useLastPracticeLog` fetch, which now also
  returns the raw `logs` window alongside `logsByMode`. `getDocs` serves from the
  Firestore offline cache when disconnected.
- Dismissal counts come from `useSectionPhaseHistory`, a `getDocs` of the newest
  `PHASE_HISTORY_LIMIT` (10) transition docs ordered by `date` desc. Its `reload`
  is called after each resolution.
- All writes go through `awaitWrite`, so they queue offline.
- A phase change and its transition doc are written in **one `writeBatch`**
  (`queuePhaseChange` / `useChangeSectionPhase`) — never a phase change without
  its audit row. The run-through save queues onto the batch it already owns.

## 5. UI

### 5.1 The offer

Evaluated **after** the save commits, never before. In the coach the log form is
on screen while the timer runs, so an in-form button would produce transitions
made on mood rather than on logged evidence.

**Standalone section practice** (`app/(app)/piece/[id]/practice.tsx`, the
`saved && !inCoach && scopedSection` branch): `PhaseOfferCard` in
`TechniqueLogComparison`'s `beforeActions` slot, above the Done button.

**Inside the coach**: `PhaseOfferDialog`, rendered by `app/(app)/session/coach.tsx`
after the save succeeds and **before** `advance("completed")`, mirroring
`DurationPromptDialog`. `PiecePracticeContent` unmounts on advance, so the block
body leaves the offer on `CoachContext.phaseOfferRef` and the coach screen
resolves it.

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
`Dialog.*` children in a Fragment, which would take the injected `style` prop.

### 5.2 `SectionPhaseChip` stays

The chip remains the always-present manual override on the piece detail row and
in `SectionsPracticePanel`. The buttons are contextual nudges that appear and
vanish with the evidence; the chip never moves. They must not look alike — the
offer is a card/dialog with copy and checkboxes, the chip is a chip.

Chip-driven changes go through `useChangeSectionPhase`, so they write
`phaseChangedAt` and a `phase-chip` transition doc.

### 5.3 Add-section nudge

`addSectionNudgeSection(piece, sections)` (`utils/add-section-nudge.ts`) returns
the section to name — the furthest along by `order` — or null. A learning piece
**qualifies** when all hold:

- `piece.state === "learning"`
- it has at least one non-archived section
- **no** non-archived section has `phase === "learning"`
- `piece.allSectionsAdded` is not true

It fires when the last learning section reaches **stabilizing**, not maintenance
— the window where there is attention to spare for new material, and where
anchor-piece cohesion (`learning-line-greedy-selection.md` §2) makes A and B
reinforce each other.

**Coach summary** (`app/(app)/session/summary.tsx`): after the block list, an
`AddNextSectionNudge` per qualifying piece — but only for pieces that appear in
`session.plan.blocks`, so the summary reports on the session just practised
rather than auditing the whole library.

**Piece detail** (`app/(app)/piece/[id]/index.tsx`): the same card above the
sections list whenever the piece qualifies.

Copy: "Section {label} is stabilizing — ready to add the next passage of
{piece}?" Actions:

- **Add section** → `router.push('/piece/{id}/section/new')`. One tap to the
  action, never a bare dismiss.
- **No more sections** → sets `allSectionsAdded: true`.

**Piece edit** (`app/(app)/piece/[id]/edit.tsx`): an "All sections added" switch,
so the flag can be cleared again.

## 6. Logging

- `phaseTransitions` (§4.3) is the record. Accepted and dismissed both.
- No new per-session log fields. `quality`, `effort` and `achievedBpm` already
  carry everything the criteria read.
- The run-through demotion writes `phaseChangedAt` and a `run-through` transition
  doc, so every coached phase change in the app has one shape.

## 7. What this feature does **not** change

Stated so a reviewer does not go looking:

- **Scoring.** `PHASE_SCORE`, `BPM_GAP_WEIGHT`, `NEEDS_WORK_WEIGHT` and every
  formula in `utils/planner-scoring.ts` are untouched. The phase change itself is
  the whole effect on the planner.
- **Block sizing and the learning line.** Unchanged.
- **The run-through credit/demotion path.** Only gains the two audit writes.
- **Section BPM and history on demotion.** `byMode`, `currentBpm` and the logs
  are preserved exactly — a demoted section keeps its earned history.
- **`MODE_LOG_LIMIT` or the log query.** `useLastPracticeLog` returns one extra
  field; it fetches exactly what it did before.

## 8. Out of scope

Deliberately excluded. Each is a separate issue if the need shows up in use:

- **Any automatic phase change** from these criteria. The app nudges; the student
  taps. This is `docs/PROJECT.md`'s student-gated principle and it is not
  negotiable here.
- **Advancing or demoting whole pieces** (`piece.state`), including "the last
  section reached stabilizing, promote the piece".
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
- **The >9-minute-block demotion trigger** floated in
  `learning-line-greedy-selection.md` §3.3. Block duration is not evidence about
  a section; the quality/effort signal already covers it.
- **Nudging about techniques.** Sections only — techniques have their own state
  model.
- **Backfilling `phaseChangedAt`** from anything.
