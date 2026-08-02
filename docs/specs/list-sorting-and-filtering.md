# Phase 0: Handoff

- Spec file: `docs/specs/list-sorting-and-filtering.md` (this file).
- Tracking issue: **#82** — use the **Phases** section below as the implementation plan, in order.
- Related: **#84** (cleanup — rename `section.phase` → `section.state`). Out of scope here; do not
  start it as part of #82.
- Move #82 to **In Progress** on the board, then run `scripts/sync-todo.sh`.
- After every phase is verified, close #82 via `Closes #82` in the PR body and re-run
  `scripts/sync-todo.sh`.
- Verify per `.claude/CLAUDE.md`: all tests + lint green (fix pre-existing failures too), and manual
  Playwright testing on the correct port (8081 main / 8082 worktree).

---

# Sorting & Filtering for Pieces and Techniques

## What

Replace the single-select status dropdown on the pieces and techniques lists with a persisted sort
menu (default: recommendation score) and a filter sheet whose active filters appear as removable
pills.

## Why

The lists only support one filter (status, single-select) and have no sort control, so a growing
repertoire is browsed in arbitrary Firestore order. Defaulting to score puts the app's own
recommendation at the top of the list the user opens most, and the remaining sorts/filters make the
list usable as a library-management view (find by composer, by collection, by length available).

Pedagogical constraints from the `piano-practice-teacher` review that shaped the scope:

- Score is a **sort**, never a visible number and never a filter — "score 47" means nothing to a
  student. Order carries the message.
- Neglect matters as much as score: a **Last practiced** sort was added, and never-practiced pieces
  count as maximally stale (mirrors `daysSince` = 999 in `utils/planner-scoring.ts`).
- **Shelved pieces are noise** in the working list and are hidden by default (techniques already do
  this with `retired`).

## Data model

**No Firestore schema changes. No rules changes. No migration.**

New local (AsyncStorage) state only, keyed per user, following the existing
`utils/session-storage.ts` pattern:

| Key                          | Value                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `pieces-list-prefs:<uid>`    | `{ sortKey, sortDir, filters: { states, composers, collections, difficulties, lengthMinMin, lengthMaxMin } }` |
| `technique-list-prefs:<uid>` | `{ sortKey, sortDir, filters: { states, types } }`                                      |
| `piece-scores:<uid>`         | `{ scores: Record<pieceId, number>, computedAt: number }`                               |

Search text is **not** persisted.

### Derived piece score

New shared util `utils/piece-scoring.ts`:

```ts
scorePiece(piece, sectionsForPiece, now): number
  // sections present -> max(scoreSectionCandidate(...)) over non-archived sections
  // no sections       -> scoreMaintenancePiece(piece, now)
```

This is the aggregation `utils/overview-suggestions.ts` already performs inline in
`sectionBasedSuggestions()` (best-by-piece via `buildSectionCandidates`). Extract it so the list and
the overview can never disagree.

New shared hook `hooks/use-piece-scores.ts`:

- Consumes `usePieces()` + `useAllSections()`, computes `Record<pieceId, number>` via `scorePiece`,
  memoized in memory.
- Persists `{ scores, computedAt }` to `piece-scores:<uid>` so a cold open can sort immediately,
  before section listeners have delivered.
- Recomputes when pieces/sections change **and** (`max(lastPracticed) > computedAt` **or**
  `now - computedAt > 30 min`). Otherwise the cached scores stand — practice is the only thing that
  meaningfully moves them.
- `app/(app)/(tabs)/overview.tsx` is refactored to consume this hook so both screens share one
  number.

## UI flow

### Header controls

Both tab screens get two `headerRight` icon buttons (set via `navigation.setOptions`):

```
┌─ Pieces ─────────────────────── [↕] [⚇•] ─┐
[Search................................... ]
[Beethoven ✕][Learning ✕][3-8 min ✕][Clear all]
│ piece rows…
```

- **↕ sort** — opens an RNP `Menu` listing the sorts; the active one is check-marked. Tapping the
  active sort toggles direction; tapping another switches to it at its default direction.
- **⚇ filter** — opens the filter sheet. Shows a badge dot whenever any non-default filter is active.

### Sorts

| Screen    | Options (default first)                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| Pieces    | **Score** (high→low), Last practiced (oldest→newest), Piece name (A–Z), Composer (A–Z), Collection (A–Z), Length (short→long), Difficulty (easy→hard), Status (learning→shelved) |
| Technique | **Score** (high→low, via existing `scoreTechnique`), Last practiced, Name, Type, Status      |

Rules:

- Direction is user-togglable per sort and persisted alongside `sortKey`.
- Ties break on title A–Z (`localeCompare`) for every sort.
- **Missing `durationSeconds` / `difficulty` always sort last**, in both directions — the top of the
  list stays meaningful. (This supersedes the issue's "treated as 0".)
- **Never-practiced sorts first** in Last practiced (oldest-first) — it is the most neglected, and
  this matches the planner's 999-day rule. It is the one deliberate exception to "unknowns last".
- Status sort uses the declared order of `PIECE_STATES` / `TECHNIQUE_STATES`.

### Filter sheet

`Portal` + RNP `Modal`, scrollable, bottom-anchored on compact (`useIsCompact()`) and a centered card
on wide. **Live-apply**: every tap updates pills and the list behind the sheet; the footer holds only
`Clear all` and `Done`. No draft state, no Apply/Cancel.

Pieces:

| Filter     | Control                          | Notes                                                             |
| ---------- | -------------------------------- | ----------------------------------------------------------------- |
| Status     | multi-select chips               | All `PIECE_STATES`. Default = everything **except** `shelved`.     |
| Composer   | multi-select, values from library | Section hidden when the library has < 2 distinct composers.        |
| Collection | multi-select, values from library | Section hidden when < 2 distinct collections. Ignores null.        |
| Difficulty | multi-select `1`–`5`             |                                                                    |
| Length     | `min` / `max` numeric, minutes   | Either side optional. Pieces with `durationSeconds == null` are **excluded** while active. |

Technique: Status (multi, `retired` off by default — preserves today's behaviour) and Type (multi,
`TECHNIQUE_TYPES`).

Composer/collection values are derived from the loaded list, de-duplicated on the trimmed stored
string, sorted A–Z.

### Pills

One pill per **selected value**, no category prefix — `[Beethoven ✕]`, `[Learning ✕]`. `✕` removes
that single value.

- Ranges collapse to one pill with a unit so they read unambiguously: `3–8 min`, `≥5 min`,
  `≤10 min`. Difficulty pills read `Difficulty 3` (a bare `3` is meaningless).
- The **default** state (shelved hidden / retired hidden) produces **no pill** — only deviations
  from the default show.
- Row scrolls horizontally, with a trailing `Clear all` when any pill is present. The row renders
  nothing when no filter is active, so an unfiltered list has zero extra chrome.

### Empty state

When filters/search hide everything: "No pieces match your filters" plus a `Clear all filters`
button. Distinct from the genuinely-empty-library state.

### Score loading

Sorting by score paints immediately from the cached/fallback scores and re-sorts once
`useAllSections()` delivers. No extra spinner.

## Logging

**None.** No analytics infrastructure exists in the repo, and the persisted `sortKey` already reveals
which sort survives daily use. Cheap signals to add later, not here.

## Out of scope

- Score min–max filter — deferred outright (score is opaque as a filter input; revisit alongside a
  "not practiced in N days" filter and decide which, if either, is needed).
- "Not practiced in N days" filter — deferred with the above.
- Priority badges (Overdue / Due soon / …), "needs attention" markers, raw score display.
- Sorting/filtering by aggregated **section** phase.
- Renaming `section.phase` → `section.state` — that is **#84**. In this feature `piece.state` is
  surfaced under the UI label **"Status"**; the word "Phase" does not appear in these screens.
- Firestore-side sorting/pagination — all sorting and filtering is client-side over the already-loaded
  list.
- Usage analytics.

## Phases

**Phase 1 — Piece score util + shared hook**
`utils/piece-scoring.ts` (`scorePiece`), `hooks/use-piece-scores.ts` (memo + `piece-scores:<uid>`
cache, 30-min / practice-change invalidation), storage helpers in `utils/session-storage.ts`.
Refactor `utils/overview-suggestions.ts` / the overview screen to consume the shared util so both
surfaces share one number. Unit tests for aggregation (sections vs no sections), cache invalidation
branches, and overview parity.

**Phase 2 — Pure sort/filter engine**
`utils/list-sorting.ts` + `utils/list-filtering.ts`: sort comparators (direction, unknowns-last,
never-practiced-first, title tie-break) and filter predicates (status/composer/collection/difficulty/
length; technique status/type), plus derivation of available composer/collection values. Prefs
read/write with schema-version + fallback to defaults on parse failure. Fully unit-tested; no UI.

**Phase 3 — UI shell components**
Generic, config-driven `components/ui/SortMenu.tsx`, `components/ui/FilterSheet.tsx`,
`components/ui/FilterPillRow.tsx` (+ header icon buttons with active-filter badge). Built to serve
both screens: the caller passes filter definitions and labels. i18n keys added.

**Phase 4 — Wire the pieces screen**
`app/(app)/(tabs)/piece.tsx` adopts the shell: header icons, pills, sheet, persisted prefs, score
sort via `usePieceScores()`, shelved hidden by default, new empty state. Stops using
`StateFilterDropdown`.

**Phase 5 — Wire the technique screen**
`app/(app)/(tabs)/technique.tsx` adopts the same shell with its own sorts/filters and its own prefs
key; `retired`-hidden-by-default behaviour preserved. Delete `components/ui/StateFilterDropdown.tsx`
once unused.

**Phase 6 — End-to-end verification**
Full `yarn test` + lint (fix pre-existing failures). Playwright pass on both screens: each sort and
its direction toggle, each filter type, pill removal, `Clear all`, persistence across reload, shelved
hidden by default, filtered empty state, and compact vs wide layouts.
