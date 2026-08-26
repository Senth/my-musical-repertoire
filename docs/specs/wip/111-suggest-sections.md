# Handoff

- This file is the implementation plan; `/implement` works the **Phases** in order.
- Read [`.claude/CLAUDE.md`](../../../.claude/CLAUDE.md) and
  [`planner-scoring.md`](../planner-scoring.md) §3 and §7 first — §7 is the section this
  change rewrites.
- Nothing durable may live only in **Handoff**, **Acceptance** or **Phases**. `/ship`
  deletes all three.
- After the last phase: `/review` in a fresh session, then `/ship` on a PASS.

## 1. What

Practice Today suggests **sections**, not whole pieces: a learning or stabilizing card
names the passage, opens it directly in the hand that scored it, and a piece may hold
more than one card once every other piece in that category already has one.

## 2. Why

The overview scored sections and then threw the section away.
`sectionBasedSuggestions` built a full `SectionCandidate` — phase, mode, BPM gap, the
lot — and `bestCandidateByPiece` collapsed it to `{ piece, score, reason }`. The card
that reached the student said "Chopin Op. 10/4", which as an instruction means *play the
whole étude*. That is the thing Margit would not assign, and the reason Erik has been
skipping the card for months: it reads as a twenty-two-minute job when the app knew
perfectly well it meant bars 33–40.

The coach session never had this problem. `stillAvailable` dedupes on
`usedSectionIds`; `usedPieceIds` only guards pieces that have no sections at all. So
several sections of one piece already share a session. The overview was the outlier,
and the "only one thing per piece" rule the issue remembers was never written down —
it was `bestCandidateByPiece` doing de-duplication and being mistaken for pedagogy.

**Breadth-first over pure score order.** Dropping the collapse and sorting by score is
the smaller diff, and it is wrong for the surface. Every unpractised section of a
learning piece accrues 10/day, so a finely-sectioned piece out-scores a coarsely
sectioned neighbour for as long as it has untouched sections. David has four learning
pieces and a Ligeti in six sections; pure score hands the Ligeti both slots for three or
four days while the Kurtág disappears from the day's list. It self-corrects, but the lag
scales with how finely he sectioned the piece, which is the wrong thing for it to depend
on. So: pass one takes each piece's best candidate, pass two spends leftover slots on
second sections. The accidental coverage the collapse provided becomes deliberate.

**Not the coach's piece anchor.** `learningLinePool` deliberately orders *every*
candidate of the top piece ahead of the second piece's, so you warm into new bars
through the ones before them in one sitting. That is depth, and it is right inside a
session. The overview is a daily menu across the whole repertoire and its job is
breadth. The two surfaces disagree on purpose.

**The reason line had to move with the score.** `scoreSectionModes` picks a winning
mode and scores *that*; `reasonForCandidate` read the section rollup. The piece-level
practised-today filter hid the disagreement, because a section that had been touched
today never came back. Per-mode return exposes it: a section drilled left hand at 08:00
returns at 19:00 for the right and says "0 day(s) since last practice" as the reason to
practise it. Advice a student cannot audit is advice they stop following. The reason now
reads the same `byMode` entry the score did.

**Naming the hand is what makes the same-day return legible.** Without it the card looks
like the app forgot what was just logged. It is named on every card a mode scored, not
only on the ambiguous ones — wording that changes with state the student cannot see is
its own kind of unauditable.

## 3. Data model

**No change.** No collection, no field, no index, and nothing new written. Every input
already exists: `Section.byMode[key]`, the section rollups, `Section.startBar` /
`endBar` / `label` / `phase`. `bestCandidateByPiece` was pure computation over data
already in memory, so removing it strands nothing.

**No migration.** Documents written under the old behaviour are read identically.

`utils/delete-account.ts` and `clearLocalUserData` are untouched — this change
introduces no user-owned collection and no device storage key.

## 4. Rules

None. `firestore.rules` is unchanged, so no `yarn deploy:dev` gates this.

## 5. UI flow

### The suggestion card

`app/(app)/(tabs)/overview.tsx`. A card whose suggestion carries a section:

| Slot | Now | After |
| --- | --- | --- |
| Title | `piece.title` | unchanged |
| Subtitle | `piece.composer` | `Composer · Bars 33–40` |
| Chip | `PieceStateChip(piece.state)` | `SectionPhaseChip(section.phase)` |
| Section count | `piece.sectionCount` line | removed |
| Reason | rollup-derived | winning-mode-derived, hand named |
| Practice | `?from=overview` | `?sectionId=…&mode=…&from=overview` |
| `key` | `s.piece.id` | the candidate's key |

The subtitle reuses the `·` idiom `formatComposerLine` already establishes. The section
falls back to `section.label` when it has no bar range — a bare `B` is poor vocabulary,
but dropping it entirely makes two cards for one piece identical at arm's length, and
being tellable apart matters more than reading well.

`piece.sectionCount` comes off **every** suggestion card, whole-piece ones included. On
a card naming one passage it reads as three things to do; on a maintenance card it is
decoration. The `piece.sectionCount` t() key survives — the pieces list uses it at
`app/(app)/(tabs)/piece.tsx:380` and `:513`.

Performance and maintenance cards keep `PieceStateChip` and are unchanged otherwise:
they are scored whole-piece by `scoreMaintenancePiece` and have no section to name.

### The chip

A stabilizing piece can hold a learning section, and it is the learning section that put
the card on screen. Chipping the piece's lifecycle state tells that student to run the
passage at tempo. `components/section/SectionPhaseChip.tsx` already exists and the
practice screen already shows it one tap later — the card just has to agree.

### The deep link

`/piece/[id]/practice` gains a `mode` param beside `sectionId`, passed to the
`preselectMode` prop that `PiecePracticeContent` already accepts and that
`app/(app)/session/coach.tsx:361` already supplies from `currentBlock.modeKey`. Without
it `use-mode-drafts.ts:110` re-picks the hand through `pickPreselectedHands`, a BPM-gap
heuristic that can land on a different hand than the one the card named. `reachablePreselect`
already drops a mode the section cannot offer, so a stale or hand-edited param degrades
to today's behaviour rather than erroring.

### Offline

Unchanged. Suggestions are computed in memory from listeners that are already open, and
this change writes nothing.

## 6. Strings

One key is born:

```json
"screen.overview.pieceReason.withMode": "{{mode}} · {{reason}}"
```

It wraps the five existing `pieceReason` keys rather than duplicating each one with a
hand prefixed. `mode` comes from `modeLabelLong` (`utils/mode-label.ts`), which yields
`Left hand`, `Right hand`, `Hands together`.

No key dies. Reused unchanged: `screen.pieceSections.barRange`,
`screen.pieceSections.barFrom`, `screen.practice.modes.handsLong.*`,
all of `screen.overview.pieceReason.*`, and `screen.overview.emptyState.*`.

## 7. Logging

None. No new signal is recorded, and no future recommendation is fed. Every input this
change reads is already written by practice logging — see
[`planner-scoring.md`](../planner-scoring.md) §8.

## 8. Privacy

None. No new kind of data, no new storage location, no third party, no change to
retention or to what the student can do with their own data. Nothing in `screen.privacy`
or `screen.terms` becomes inaccurate, so `lastUpdated` is not bumped and no 30-day
notice is owed.

## 9. Acceptance

1. [test] A stabilizing piece is suggested by section and the card names that section's bars
2. [test] Two sections of one piece both appear in Practice Today when no other piece is waiting
3. [test] A second section of an already-suggested piece yields its slot to an unrepresented piece
4. [test] The Practice button on a section card opens that section with its scored hand selected
5. [test] A section practised left hand today is suggested again the same day for right hand
6. [test] A learning section inside a stabilizing piece is chipped Learning on the overview
7. [test] The all-practised message appears only when no suggestion remains
8. [eye] Two cards for the same piece are tellable apart at a glance from arm's length
9. [eye] The reason line naming a hand reads as advice rather than as a log entry

## 10. What this does NOT change

- The score formula in `utils/planner-scoring.ts`. Weights, terms and phase rows are
  untouched, so `scorePiece` and the pieces-list ordering are byte-identical.
- Performance and maintenance suggestions, which stay whole-piece via
  `scoreMaintenancePiece`, keep `PieceStateChip`, and keep their caps of 2 and 2.
- The session coach planner. It already permits several sections of one piece and keeps
  its piece-anchored ordering.
- The `noActivePieces` and `allMaintenance` empty states and their conditions.
- Section phase progression, which stays student-gated
  ([`section-phases.md`](../section-phases.md)).
- What the reason line *can* say. The five reason keys and the rule that the reason names
  whichever score term contributed most both survive; only the stats it reads move.

## 11. Out of scope

- **Offering the A+B seam** when two adjacent sections of one piece appear together.
  Pedagogically the right moment, but practising a join needs a scope spanning two
  sections, and section practice is scoped to one `sectionId` end to end — logging,
  `byMode`, phase, all of it. Filed as #115.
- **Nudging an unsectioned learning piece to split into passages.** Needs a "keeps being
  suggested" signal that nothing records; the overview is computed fresh each render.
  `addSectionNudgeSection` does not cover it — it returns null for a piece with zero
  sections (`utils/add-section-nudge.ts:24`). Filed as #116.
- **Session-duration awareness in the overview**, already settled in
  [`planner-scoring.md`](../planner-scoring.md) §9.
- **Per-category sub-headers**, same place.

## 12. Phases

```
Phase 1  selection + reason logic in utils/, with jest tests        feature-large
Phase 2  extract the bar-range formatter, reuse at 3 call sites     feature-small
Phase 3  overview card, the mode param, the new t() key             feature-small
Phase 4  e2e specs for the seven [test] claims                      feature-small
```

**Phase 1** — `utils/overview-suggestions.ts` and `utils/piece-scoring.ts`.
Delete `bestCandidateByPiece` and its `describe` block in `utils/piece-scoring.test.ts`;
that block only ever asserted the collapse, which is the behaviour being removed, so
nothing it protected survives. `sectionBasedSuggestions` returns every candidate.
Selection becomes breadth-first: rank pieces by their best candidate, take one each,
then spend remaining slots on next-best candidates from pieces already shown. Section
candidates filter on `candidate.practicedToday`, not `piece.lastPracticed`.
`reasonForCandidate` reads `section.byMode[candidate.modeKey]` and
`targetForMode(hands, effectiveTarget)` so it mirrors `scoreSectionModes` the way it
already mirrors `scoreSectionCandidate`, and returns the mode alongside the reason.
`allPracticedToday` fires when the assembled list is empty and at least one active piece
exists. Caps become 2 / 2 / 2 / 2.

**Phase 2** — the same bar-range block is written out three times already:
`app/(app)/piece/[id]/index.tsx:128`, `components/section/SectionDetailRow.tsx:61`,
`app/(app)/piece/[id]/practice.tsx:576`. Phase 3 needs a fourth. Extract
`formatBarRange(section, t)` into `utils/piece-display.ts` beside `formatComposerLine`,
with a sibling test, and replace all three. Pure refactor: identical output.

**Phase 3** — the card per §5, `SectionPhaseChip` swapped in, the count line removed,
the key fixed, and the `mode` param read in `PracticeScreen` and handed to
`preselectMode`. Adds `screen.overview.pieceReason.withMode` to
`i18n/locales/en-US.json`.

**Phase 4** — the seven `[test]` claims become `e2e/` tests titled with the claim text
verbatim, which is what `yarn invariants` checks.
