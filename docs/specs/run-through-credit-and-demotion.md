# Phase 0: Handoff

**Spec:** `docs/specs/run-through-credit-and-demotion.md` (this file).
**Tracking issue:** [#100](https://github.com/Senth/my-musical-repertoire/issues/100).

Implementer instructions:

1. **§9 Phases is your implementation plan.** Work them in order, one phase per
   session. Each is independently deliverable — do not merge phases or skip
   ahead.
2. Read §3 (Behaviour) and §8 (Out of scope) before writing anything. §8 is
   binding: the design deliberately has no flag entity, no cascading demotion, no
   automatic promotion, no tempo prescription. Do not reintroduce them because
   they seem obviously useful.
3. §7 lists two properties that are **already true in the code**. They need
   regression tests, not implementation.
4. After each phase run `yarn test` and lint, and fix any failures including
   pre-existing ones.
5. Phase 5 is full end-to-end verification with Playwright against the running
   dev server. It is not optional.
6. Tick this issue's task list as phases land. When every phase is verified,
   close #100 from the PR body with `Closes #100` and run `scripts/sync-todo.sh`.

---

# Run-through credit and demotion

Tracking issue: [#100](https://github.com/Senth/my-musical-repertoire/issues/100)

## 1. What

A whole-piece run-through of a maintenance or performance piece now updates its
maintenance-phase sections: the ones the student did not tick keep their recency
and tempo (credit), and the ones they ticked as shaky are demoted back to the
stabilizing phase so the planner starts scheduling them again.

## 2. Why

A maintenance-phase section inside a maintenance- or performance-state piece is
**unreachable today**. The learning line only looks at `learning`-state pieces;
the stabilizing line takes only `learning`/`stabilizing`-phase sections out of
maintenance/performance pieces; the maintenance line schedules whole pieces and
never sections. So those sections are never planned, never logged, and their
`lastPracticed` freezes — `daysSince` climbs forever against a score nothing
reads.

Meanwhile the one signal that *does* exist is wired backwards. Ticking a section
as bad currently writes `lastPracticed = serverTimestamp()` to it
(`hooks/use-practices.ts:66-76`), resetting `daysSince` to 0 and **lowering** the
score of the exact section that just fell apart.

Both halves of the run-through carry information, and both are being thrown away:

- **Unticked** — the section held together at tempo, in context, under the
  pressure of a continuous play-through. That is genuine maintenance-phase
  practice and it should refresh recency.
- **Ticked** — the section was *revealed* weak, not repaired. A run-through is
  not repair work, so it must not count as practice; and a section that fails in
  performance context is by definition no longer maintained.

Demotion, not a priority flag, is the mechanism. Moving the phase from
`maintenance` to `stabilizing` triples the decay rate (`PHASE_SCORE` 1 → 3) and
puts the section into the stabilizing line's pool, where it competes on the same
formula as everything else. We do not claim to know that a shaky section matters
more than any other stabilizing section — we only claim it is no longer
maintained. The existing score handles the rest.

## 3. Behaviour

Everything below applies **only** when the parent piece's state is `maintenance`
or `performance`, and **only** to sections whose phase is `maintenance`.
Everything else is untouched.

| `piece.state` | `section.phase` | ticked | effect |
| --- | --- | --- | --- |
| maintenance / performance | maintenance | no | **credit** |
| maintenance / performance | maintenance | yes | **demote** → `stabilizing`, no credit |
| maintenance / performance | stabilizing, learning | either | nothing written |
| learning, stabilizing, on_hold, shelved | any | either | nothing written |

Archived sections are never touched — the panel does not list them.

### 3.1 Credit

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

Then the section's derived fields are recomputed with the existing
`deriveFromByMode` (`lastPracticed`, `lastQuality`, `lastEffort`, `currentBpm`).

Three deliberate conservatisms:

- **BPM never drops.** `currentBpm` is earned history from isolated work; a
  run-through taken below that tempo is not evidence the section got slower.
  A blank `achievedBpm` writes nothing.
- **Quality is never invented.** A section that was never rated stays `null`.
  (`needsWorkTerm` already treats `null` as quality 5.)
- **Quality rises at most one step, and only after a clean run.** One good
  play-through must not erase three bad isolated logs. `prev ?? 3` is *not*
  used — no prior rating means no bump.

Credit is granted regardless of how badly the run went. The student ticked the
sections that failed; the rest held up, and that is their word on it.

### 3.2 Same-day exclusion

Credit sets `byMode.HT.lastPracticed = now`, so `allModesPracticedToday` treats
the section as done for the day and it drops out of every line. This is correct
and needs no new code:

- section with only `HT` → excluded for the rest of the day
- section with `HT` + `LH`/`RH` → still scores on the stale separate-hands modes
- **ticked section** → nothing written → still schedulable for repair in a later
  session the same day

### 3.3 Demotion

`section.phase` is set to `stabilizing`. No new fields, no flag entity, no
history record. Recovery is the editable `SectionPhaseChip` that already exists
in the sections panel (`components/practice/SectionsPracticePanel.tsx:80`) and on
the piece detail screen — the student can move a phase back by hand.

There is no automatic promotion back to `maintenance`. That stays manual, as it
is today.

## 4. Data model

No new collections. No new fields on `Section` or `Piece`.

**`pieces/{id}/practiceLogs/{id}`** — unchanged. Already carries
`flaggedSectionIds`.

**`pieces/{id}/sections/{id}/practiceLogs/{id}`** — one new doc per *credited*
section, matching the existing section-log shape plus one field:

```
date, hands: "HT", drill: null,
quality, effort, achievedBpm,
triggeredFrom, sessionId,
source: "run-through"          // NEW — absent on all existing logs
```

`source` is additive and optional; `normalizeLastLog` ignores unknown fields, so
old logs read back as before. Ticked sections get **no** log — there are no
stats to record.

**`pieces/{id}/sections/{id}`** — `byMode.HT` plus derived fields on credit;
`phase` on demotion. Nothing else.

`firestore.rules` needs no change: both paths are already written by
`useSaveSectionPractice`.

### 4.1 Write shape

One `writeBatch` for the whole save — piece log, piece update, and every section
log and section update — committed through the existing `awaitWrite`. An
8-section piece goes from ~18 round trips to one, the save is atomic (never a
demoted section without its piece log), and it queues offline as a single unit.
Well under the 500-op batch limit.

The section `byMode` values are read from the `useSections(pieceId)` snapshot the
practice screen already holds, **not** re-fetched with `getDoc`. That keeps the
save working offline, where `getDoc` may reject.

## 5. UI flow

**Whole-piece practice screen** (`app/(app)/piece/[id]/practice.tsx`)

- Section checkboxes are shown at **every** mistake level for maintenance and
  performance pieces, replacing the current `>= some(2)` gate at line 183. With
  unticked now meaning "credited", the student must always be able to withhold
  credit — they often know the exact bar that fell apart after an otherwise
  clean run.
- Checkboxes render only on maintenance-phase rows. Learning/stabilizing-phase
  rows in the same piece keep their current appearance; ticking them would do
  nothing, so they must not offer a checkbox.
- Header copy switches to the "which sections need work?" wording at all levels.
- If a maintenance/performance piece has no maintenance-phase sections, nothing
  changes on screen.

**After save**, when at least one section was demoted, a snackbar:
"2 sections moved back to stabilizing".

**Inside the coach**, `PiecePracticeContent` unmounts the moment the block
advances, so a local snackbar would never be seen — and the coach is where
maintenance run-throughs actually happen. `CoachContext` gains
`notify(message: string)`; `app/(app)/session/coach.tsx` renders a single
`Snackbar` outside the block body so it survives the advance. The practice
component calls `coach.notify(...)` when `inCoach`, and uses a local snackbar
when standalone.

## 6. Logging

- Piece log: `flaggedSectionIds` (existing) is the record of which sections
  failed the run-through.
- Section logs: `source: "run-through"` distinguishes credit from isolated
  practice, so later analysis can separate "held up in context" from "repaired
  in isolation" without guessing from `triggeredFrom`.
- Demotions are not separately logged. The phase change plus the piece log's
  `flaggedSectionIds` reconstruct the event.

## 7. Verified invariants (tests, no code change)

Two properties the issue asked about are already true. They get regression tests
so a future change cannot quietly break them:

- **Maintenance blocks are whole-piece only.** `maintenanceBlock`
  (`utils/session-planner.ts:488-498`) always sets `sectionId: null`, so the
  coach renders the whole-piece form for every `repertoire-maintenance` block.
  Test: every maintenance block in a built plan has `sectionId === null`.
- **The stabilizing line already scores all three phases** for stabilizing-state
  pieces — `stabilizingLinePool` calls `buildSectionCandidates` on them with no
  phase filter (`utils/session-planner.ts:151-155`). Only the
  maintenance/performance branch filters to `learning`/`stabilizing`. Test both
  halves, so demoted sections in stabilizing pieces keep their coverage.

## 8. Out of scope

Deliberately excluded — each is a separate issue if the need shows up in use:

- **Any flag entity.** No `openFlag`, no `flagHistory`, no `FLAG_WEIGHT` score
  term. Demotion is the whole mechanism. A manual "practise this more" marker
  can be added later if demotion proves too blunt.
- **Cascading demotion.** A ticked `stabilizing`- or `learning`-phase section is
  not demoted further.
- **Automatic promotion back to maintenance**, and any evidence-based criteria
  for it. Manual via the phase chip.
- **Undo affordance** for demotion. The editable phase chip is the recovery path.
- **Technical vs memory branching** — different repair prescriptions, focus
  categories, drill suggestions.
- **`suggestedStartBpm`.** `currentBpm` is never mutated downward and no tempo is
  prescribed.
- **Chronic-failure escalation** to the learning phase, and piece-level
  "maintenance → stabilizing" suggestions in `utils/overview-suggestions.ts`.
- **Per-section severity input.** Severity stays piece-level, and with no flag
  entity it currently weights nothing.
- **"Why this now?" block rationale.** `PlannedBlock.rationale` exists but is
  unused; that is issue #17.

## 9. Phases

**Phase 1 — pure logic + unit tests**

New `utils/run-through-credit.ts`. One pure function taking the piece, its
sections, `flaggedSectionIds`, both mistake levels, `achievedBpm` and `now`,
returning `{ credits, demotions }` — no Firestore, no React. `credits` carries
the new `byMode`, the derived fields, and the log payload per section.

Tests cover: piece-state gating; phase gating; ticked vs unticked; blank
`achievedBpm`; BPM never lowered; `quality === null` stays null; the one-step cap
at 5; no bump when mistakes >= `some`; `effort` preserved; archived sections
skipped; a piece with no maintenance-phase sections producing an empty result.

**Phase 2 — persistence**

Rewrite `useSavePractice.savePractice` to take the sections and piece state,
call the Phase 1 function, and commit everything in one `writeBatch` through
`awaitWrite`. **Delete** the `lastPracticed: serverTimestamp()` write at
`hooks/use-practices.ts:66-76`. Update the call site in
`app/(app)/piece/[id]/practice.tsx` to pass `activeSections` and the piece.

**Phase 3 — UI**

Always-visible checkboxes for maintenance-phase rows on maintenance/performance
pieces (`SectionsPracticePanel` + the `showCheckboxes` gate at
`app/(app)/piece/[id]/practice.tsx:183`); header copy; new i18n keys. Add
`notify` to `CoachContext` and a `Snackbar` at the coach screen level; wire the
demotion message through it, with a local snackbar in the standalone case.

**Phase 4 — planner regression tests**

The two invariants in §7, added to `utils/session-planner.test.ts`.

**Phase 5 — end-to-end verification**

Full `yarn test` and lint, fixing any pre-existing failures. Then Playwright
against the running dev server (main :8081 / worktree :8082, log in with the
test account) covering:

1. Maintenance piece, clean run, nothing ticked → all maintenance-phase sections
   show a refreshed last-practised date; quality rose by one where it had a
   prior rating.
2. Same piece, tick one section → snackbar appears, that section's phase chip
   reads "stabilizing", its last-practised date is unchanged.
3. Same flow inside a coach session → snackbar survives the block advance.
4. A learning-state piece with sections → whole-piece log writes nothing to any
   section.
