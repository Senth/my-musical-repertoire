# Piece library

Tracking issues: [#15](https://github.com/Senth/my-musical-repertoire/issues/15),
[#82](https://github.com/Senth/my-musical-repertoire/issues/82)

## 1. What

Managing repertoire outside a practice session: the fields a piece carries, the
forms that capture them, the piece detail screen and its section list, and the
sorting, filtering and search that make a growing library browsable.

## 2. Why

The lists used to support one filter (status, single-select) and no sort, so a
growing repertoire was browsed in arbitrary Firestore order. Piece detail hid
notes and override BPM behind a row that showed neither, and "Manage & reorder
sections" was a separate page — a friction trip for something that belongs where
the sections are.

Pedagogical constraints from the teacher review that shaped the scope:

- **Score is a sort, never a visible number and never a filter.** "Score 47"
  means nothing to a student; order carries the message. Defaulting to score puts
  the app's own recommendation at the top of the list the student opens most.
- **Neglect matters as much as score**, so *Last practiced* is its own sort, and
  never-practised pieces count as maximally stale — mirroring `daysSince = 999`
  in the planner.
- **Shelved pieces are noise** in the working list and are hidden by default
  (techniques already did this with `retired`).
- On the section row, the three loudest signals are **phase chip, BPM gap and
  last practised** — everything else is secondary.

## 3. Data model

```ts
// models/piece.ts
export interface Piece {
  id?: string;
  userId: string;
  title: string;
  composer: string;
  collectionName?: string | null;
  state: PieceState;                 // learning | stabilizing | maintenance
                                     // | performance | on_hold | shelved
  targetTempoBpm?: number | null;
  difficulty?: 1 | 2 | 3 | 4 | 5 | null;
  durationSeconds?: number | null;   // full play-through estimate
  lastPracticed?: Date | null;
  lastTechnicalMistakes?: PracticeMistakes;
  lastMemoryMistakes?: PracticeMistakes;
  lastAchievedTempoBpm?: number | null;
  sectionCount?: number;
  notes?: string | null;
  allSectionsAdded?: boolean;        // see section-phases.md
}
```

`Section` carries `lastPracticed`, updated whenever a practice log targets it.
Missing is treated as never practised; there is no backfill.

Notes on individual fields:

- **`collectionName`, not `collection`** — the latter reads ambiguously next to
  Firestore's own `collection()` helper. **It is an internal name only:**
  everything the user sees says **"Collection"**, and the string `collectionName`
  must never appear in UI copy or i18n values.
- Blank text input saves as `null`, never `""`, so a cleared field and a
  never-set field are indistinguishable in Firestore.
- `durationSeconds` is entered as whole **minutes** in the form
  (`minutes × 60` on save) and can also be captured in-session — see
  [`session-coach.md`](session-coach.md) §5.2.
- `useUpdatePiece` uses a `Pick<>` allowlist; a new field must be added to it or
  the update is type-rejected. `useAddPiece` takes a single object parameter.

**No Firestore rules changes and no migrations** belong to this spec. Existing
pieces read missing fields back as `null`.

### List preferences (AsyncStorage)

| Key | Value |
| --- | --- |
| `pieces-list-prefs:<uid>` | `{ sortKey, sortDir, filters: { states, composers, collections, difficulties, lengthMinMin, lengthMaxMin } }` |
| `technique-list-prefs:<uid>` | `{ sortKey, sortDir, filters: { states, types } }` |
| `piece-scores:<uid>` | `{ scores: Record<pieceId, number>, computedAt: number }` |

Prefs carry a schema version and fall back to defaults on parse failure. **Search
text is not persisted.** The score cache is described in
[`planner-scoring.md`](planner-scoring.md) §6.

## 4. Forms — add and edit piece

Field order: **Title → Composer → Collection → State → Target BPM → Duration**
(and Difficulty). Collection is optional, has no validation and never blocks
save.

### Composer autocomplete

Suggestions are derived at runtime from the composer strings already saved across
the user's own pieces — no curated list, no external API. This exists to stop
typos and inconsistent spellings ("Chopin" vs "chopin") silently breaking search
and grouping.

- Shown after **1+ character**, case-insensitive substring match, capped at 5.
- Grouped case-insensitively, first-seen variant wins.
- Selecting a suggestion stores that exact string; free text is stored exactly as
  typed. Free text is always allowed.
- **No alias handling.** If the user has both "Bach" and "J.S. Bach", both appear
  as separate suggestions and the user decides.

### Collection autocomplete

Composer alone is too coarse a grouping — one composer can span many unrelated
bodies of work, and Final Fantasy VII alone has both an official OST and a Piano
Collections arrangement. The collection field answers "all pieces from this game
/ book / album".

Suggestions come from `collectionName` across the user's pieces, deduplicated
case-insensitively, capped at **5 total**. "Same composer" means the piece's
composer matches the value currently in the form's Composer field, trimmed and
compared case-insensitively:

| Collection input | Composer field | Dropdown |
| --- | --- | --- |
| empty | empty | nothing shown |
| empty | filled | collections of same-composer pieces only, alphabetical, max 5 |
| 1+ chars | either | substring match across **all** collections; same-composer matches ranked first, others after; max 5 total |

The composer filter keeps the empty-focus list short and relevant, since nearly
every piece in a collection shares a composer. Once the user types, matches from
other composers are still reachable — game and film soundtracks do have multiple
composers.

Both fields use the same `components/piece/HistoryAutocompleteInput.tsx`, which
takes a plain `suggestions: string[]`; the dedup/rank logic lives in
`utils/suggestions.ts`.

## 5. Piece detail screen

Hierarchy:

1. Appbar — title, edit, delete
2. Composer + lifecycle state chip
3. **Practice button** (full-width contained), promoted above metadata
4. Compact meta row: `last practiced · target BPM`, single line
5. Notes (collapsible)
6. Sections block — header with a `⋮` overflow offering **Reorder sections**, the
   section rows, and an inline empty state
7. FAB (+ section)

Collection renders as **muted secondary text, never as a chip** — the lifecycle
state chip must stay the most prominent signal on a piece. It is appended to the
composer line as `Nobuo Uematsu · Final Fantasy VII`, on piece detail, compact
list rows and wide card subtitles alike. When it is null or blank the separator
and value are omitted entirely.

Any qualifying add-next-section nudge renders above the sections list
([`section-phases.md`](section-phases.md) §6.3).

### Section row

```
┌──────────────────────────────────────────────────────────┐
│ Bridge        bars 33–48                          [▶]   │  bodyLarge + bodySmall · 40dp filled-tonal IconButton
│ [Stabilizing]  88 / 120 BPM · 3d ago                    │  phase chip + bpm + staleness
│ LH leaps in m. 40, memory still shaky…                  │  notes truncated, onSurfaceVariant
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░  4dp, sqrt scale, amber  │  omitted when no BPM
└──────────────────────────────────────────────────────────┘
```

- Tap the row → section detail. Tap `▶` → section-scoped practice.
- Current BPM is `deriveCurrentBpm(section.byMode)` — the minimum across
  hands modes ([`practice-logging.md`](practice-logging.md) §3). Effective target
  is `section.targetBpmOverride ?? piece.targetTempoBpm`.
- Notes line and progress bar are absent when their inputs are missing.
  Staleness uses `formatDaysAgo` and is absent when never practised.

**BPM progress visualization.** Fill is `sqrt(currentBpm / effectiveTarget)`
clamped to 0..1, so 60/120 renders ~71% rather than 50% — a linear bar misleads,
because tempo difficulty is nonlinear and the last stretch is the hard part.
Colour zones use the **raw** ratio: `< 0.70` error, `0.70–0.90` warning,
`>= 0.90` success.

### Reorder mode

Triggered from the Sections-header `⋮`. Replaces the list with draggable compact
rows (drag handle, no Practice button); the header action swaps to **Done**.
Persists through `useReorderSections`. The standalone "Manage & reorder sections"
page was deleted — reordering belongs where the sections are.

### Archive

Lives inside the section edit screen as an outlined destructive button with a
confirmation dialog, returning to piece detail on success.

### Empty state

Inline within the Sections block: `music-note-outline` icon, "No sections yet",
"Break the piece into practiceable chunks", and an outlined **Add section**
button. The FAB stays.

## 6. Sorting, filtering and search

Both tab screens get two `headerRight` icon buttons:

```
┌─ Pieces ─────────────────────── [↕] [⚇•] ─┐
[Search................................... ]
[Beethoven ✕][Learning ✕][3-8 min ✕][Clear all]
│ piece rows…
```

- **↕ sort** — a Menu listing the sorts with the active one check-marked.
  Tapping the active sort toggles direction; tapping another switches to it at
  its default direction.
- **⚇ filter** — opens the filter sheet, with a badge dot whenever any
  non-default filter is active.

### Sorts

| Screen | Options (default first) |
| --- | --- |
| Pieces | **Score** (high→low), Last practiced (oldest→newest), Piece name (A–Z), Composer (A–Z), Collection (A–Z), Length (short→long), Difficulty (easy→hard), Status (learning→shelved) |
| Techniques | **Score** (high→low), Last practiced, Name, Type, Status |

- Direction is user-togglable per sort and persisted alongside `sortKey`.
- Ties break on title A–Z (`localeCompare`) for every sort.
- **Missing `durationSeconds` / `difficulty` always sort last**, in both
  directions — the top of the list stays meaningful.
- **Never-practised sorts first** in Last practiced (oldest-first): it is the
  most neglected, and this matches the planner's 999-day rule. It is the one
  deliberate exception to "unknowns last".
- Status sort uses the declared order of `PIECE_STATES` / `TECHNIQUE_STATES`.

### Filter sheet

`Portal` + `Modal`, scrollable, bottom-anchored on compact and a centered card on
wide. **Live-apply**: every tap updates the pills and the list behind the sheet;
the footer holds only `Clear all` and `Done`. No draft state, no Apply/Cancel.

| Filter | Control | Notes |
| --- | --- | --- |
| Status | multi-select chips | All `PIECE_STATES`. Default = everything **except** `shelved`. |
| Composer | multi-select from library | Section hidden when fewer than 2 distinct composers. |
| Collection | multi-select from library | Section hidden when fewer than 2. Ignores null. |
| Difficulty | multi-select 1–5 | |
| Length | min / max, minutes | Either side optional. Pieces with `durationSeconds == null` are **excluded** while active. |

Techniques get Status (multi, `retired` off by default) and Type (multi,
`TECHNIQUE_TYPES`). Composer/collection values are derived from the loaded list,
de-duplicated on the trimmed stored string, sorted A–Z.

### Pills

One pill per **selected value**, no category prefix — `[Beethoven ✕]`,
`[Learning ✕]`; `✕` removes that single value.

- Ranges collapse to one pill with a unit so they read unambiguously: `3–8 min`,
  `≥5 min`, `≤10 min`. Difficulty reads `Difficulty 3` — a bare `3` is
  meaningless.
- The **default** state (shelved hidden / retired hidden) produces **no pill**;
  only deviations from the default show.
- The row scrolls horizontally with a trailing `Clear all`, and renders nothing
  when no filter is active, so an unfiltered list has zero extra chrome.

### Search

The `Searchbar` matches `title`, `composer` and `collectionName`
(case-insensitive substring). So "Final Fantasy VII" finds every piece in both
the OST and Piano Collections entries, while "Final Fantasy VII Piano
Collections" narrows to the latter — provided the user names the collections that
way. No special parsing.

### Empty state and score loading

When filters or search hide everything: "No pieces match your filters" plus a
`Clear all filters` button — distinct from the genuinely-empty-library state.

Sorting by score paints immediately from the cached scores and re-sorts once
`useAllSections()` delivers. No extra spinner.

## 7. Logging

None. Nothing in this spec produces practice signals or touches the planner.
Sorting and filtering are client-side over the already-loaded list, and the
persisted `sortKey` already reveals which sort survives daily use — no analytics
infrastructure exists in the repo and none is added.

The one write outside the forms is `Section.lastPracticed`, stamped by the
practice save paths.

## 8. Out of scope

- **Score min–max filter** and a **"not practiced in N days" filter** — deferred
  together; score is opaque as a filter input.
- **Priority badges** (Overdue / Due soon), "needs attention" markers, raw score
  display.
- **Sorting or grouping by aggregated section phase**, or by collection.
- **Firestore-side sorting or pagination** — everything is client-side.
- **Usage analytics.**
- **Curated or external composer/collection lists**; normalizing, merging or
  disambiguating either.
- **Autocomplete on any field other than Composer and Collection.**
- **`lastPracticed` retroactive backfill** from old practice logs.
- **Whole-piece history / charts**, PDF or sheet-music integration.
- **Native mobile testing** — web-only verification at the current project stage.
- **Renaming `section.phase` → `section.state`** —
  [#84](https://github.com/Senth/my-musical-repertoire/issues/84). In these
  screens `piece.state` is surfaced under the label **"Status"**, and the word
  "Phase" does not appear.
