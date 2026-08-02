# Phase 0: Handoff

**Spec:** `docs/specs/piece-collection-field.md`
**Tracking issue:** #15
**Implementation plan:** Use the Phases section below, in order.
**Tracking:** GitHub Issues + Kanban board (no PLAN.md).

Verification for every phase: `yarn lint` and `yarn test` must pass, including any
pre-existing failures. Final phase adds Playwright end-to-end verification.

---

# Spec: Piece Collection Field

## 1. What

Add an optional free-text `collectionName` field to pieces, with a composer-aware
autocomplete drawn from the user's own piece history, and make it searchable from the
piece list.

## 2. Why

Composer alone is too coarse a grouping. A single composer can span many unrelated
bodies of work — e.g. Nobuo Uematsu wrote for many games, and Final Fantasy VII alone has
both an official OST and a Piano Collections arrangement. A collection field lets the user
find "all pieces from this game / book / album" without scrolling the whole composer's
output.

Autocomplete exists to keep the spelling consistent. Inconsistent spellings silently break
search, which is the entire point of the field.

## 3. Data Model

New optional field on `Piece` (`models/piece.ts`):

```ts
collectionName?: string | null;
```

- Firestore field name: `collectionName`. Chosen over `collection` to avoid reading
  ambiguously next to Firestore's own `collection()` helper.
- **`collectionName` is an internal name only.** Everything the user sees says
  **"Collection"** — the form label, any placeholder, and any future filter or search
  affordance. The string `collectionName` must never appear in UI copy or i18n values.
- Same field added to `FirestorePiece` in `hooks/use-pieces.ts`.
- `fromFirestore` maps it as `data.collectionName ?? null`.
- **No migration.** Existing pieces have no `collectionName` and read back as `null`.
- Blank input saves as `null`, never `""`, so a cleared field and a never-set field are
  indistinguishable in Firestore.
- `useUpdatePiece`'s `Pick<>` allowlist gains `"collectionName"`.
- `useAddPiece` currently takes 6 positional args and would take 7. Convert it to a single
  object parameter as part of Phase 1 — there is exactly one call site
  (`app/(app)/piece/add.tsx:83`).

## 4. UI Flow

### Forms — Add Piece and Edit Piece

Field order: Title → Composer → **Collection** → State → Target BPM → Duration.

Optional. No validation, no error state, never blocks save.

### Autocomplete behaviour (Collection field)

Suggestions come from `collectionName` values across the user's own pieces, deduplicated
case-insensitively (first-seen variant wins, matching the existing composer behaviour),
capped at **5 total**.

"Same composer" means the piece's composer matches the value currently in the form's
Composer field, compared case-insensitively and trimmed.

| Collection input | Composer field | Dropdown |
| --- | --- | --- |
| empty | empty | nothing shown |
| empty | filled | collections of same-composer pieces only, alphabetical, max 5 |
| 1+ chars | either | case-insensitive substring match across **all** collections; same-composer matches ranked first, other composers' matches after; max 5 total |

Rationale for the composer filter: in practice nearly every piece in a collection shares a
composer, so the empty-focus list stays short and relevant. Once the user types, matches
from other composers are still reachable — game and film soundtracks do have multiple
composers.

Free text is always allowed. Selecting a suggestion stores that exact string.

The existing **Composer** field keeps its current behaviour (suggestions only after 1+
character). It is not changed by this feature.

### Read-only display

Rendered as muted secondary text, never as a chip — the lifecycle state chip must stay the
most prominent signal on a piece.

- **Piece detail** (`app/(app)/piece/[id]/index.tsx`): appended to the composer line as
  `Nobuo Uematsu · Final Fantasy VII`.
- **Piece list, compact** (`app/(app)/(tabs)/piece.tsx`): same `Composer · Collection`
  treatment on the existing composer text line.
- **Piece list, wide cards**: same treatment in the existing `Card.Title` subtitle.

When `collectionName` is null or blank, the separator and value are omitted entirely — the
line renders exactly as it does today.

### Search

The existing `Searchbar` on the piece list matches `title`, `composer`, and now
`collectionName` (case-insensitive substring, same as today's matching).

This means "Final Fantasy VII" finds every piece in both the OST and Piano Collections
entries, while "Final Fantasy VII Piano Collections" narrows to the latter — provided the
user names the collections that way. No special parsing.

## 5. Logging

None. This field produces no practice signals and does not touch the session planner or
recommendation scoring.

## 6. Out of Scope

- **Collection filter pills / dropdown** — belongs to issue #82 ("Improved sorting and
  filtering on pieces"), which owns the filter-pill UX for composer, difficulty, length,
  and phase. Building a one-off collection filter here would be replaced by #82.
- Sorting or grouping the piece list by collection.
- Any recommendation-engine or session-planner behaviour derived from collection.
- Changing the existing Composer field's autocomplete behaviour.
- Curated or external collection lists — history only.
- Normalizing, merging, or disambiguating collection names.

## 7. i18n

New keys in `i18n/locales/en-US.json`, mirroring the existing `composerLabel` entries:

- `screen.addPiece.collectionLabel` — "Collection"
- `screen.editPiece.collectionLabel` — "Collection"

No error keys — the field is never invalid.

## 8. Phases

### Phase 1 — Data model, hooks, i18n

1. Add `collectionName?: string | null` to `Piece` (`models/piece.ts`).
2. Add `collectionName` to `FirestorePiece` and map it in `fromFirestore` as
   `data.collectionName ?? null` (`hooks/use-pieces.ts`).
3. Convert `useAddPiece`'s `addPiece` to a single object parameter including
   `collectionName`; update the one call site in `app/(app)/piece/add.tsx`.
4. Add `"collectionName"` to `useUpdatePiece`'s `Pick<>` allowlist.
5. Add the two i18n keys.
6. Extend `hooks/use-pieces.test.ts` to cover `collectionName` present, absent, and null.
7. `yarn lint && yarn test`.

### Phase 2 — Generalized autocomplete component

1. Rename `components/piece/ComposerAutocompleteInput.tsx` to
   `components/piece/HistoryAutocompleteInput.tsx`, replacing the `pieces: Piece[]` prop
   with `suggestions: string[]`. Keep the existing dropdown, blur delay, and layout
   behaviour unchanged.
2. Extract the dedup/sort logic into a shared util (e.g. `utils/suggestions.ts`) with a
   function that dedups case-insensitively (first-seen variant wins) and sorts
   alphabetically case-insensitively.
3. Add a util for collection suggestions implementing the table in section 4:
   composer-scoped when the query is empty, all-collections with same-composer ranked
   first when the query is non-empty, capped at 5.
4. Unit-test both utils, including: empty composer + empty query yields nothing; ranking
   puts same-composer first; cap is 5 total; case-insensitive dedup.
5. Update the composer call sites to pass the derived suggestion list so nothing regresses.
6. `yarn lint && yarn test`.

### Phase 3 — Wire the Collection field into both forms

1. Add the Collection field to `app/(app)/piece/add.tsx` after Composer, using
   `HistoryAutocompleteInput` with the collection-suggestion util, passing the current
   Composer form value.
2. Same for `app/(app)/piece/[id]/edit.tsx`, prefilling from `piece.collectionName`.
3. Trim on save; save `null` when blank.
4. `yarn lint && yarn test`.

### Phase 4 — Display and search

1. Piece detail: append `· {collectionName}` to the composer line when set.
2. Piece list compact rows and wide cards: same `Composer · Collection` treatment.
3. Extend the `Searchbar` filter in `app/(app)/(tabs)/piece.tsx` to also match
   `collectionName`.
4. `yarn lint && yarn test`.

### Phase 5 — Playwright end-to-end verification

Detect the port first: `$PWD` ending in exactly `my-musical-repertoire` → 8081, otherwise
a worktree → 8082. Log in with the test credentials from `.claude/CLAUDE.md`.

1. Add a piece with composer "Nobuo Uematsu" and collection "Final Fantasy VII".
2. Add a second piece with the same composer — verify focusing the empty Collection field
   lists "Final Fantasy VII".
3. Verify a different composer's empty focus shows **no** dropdown.
4. Verify typing surfaces cross-composer matches with same-composer ranked first.
5. Verify a piece saved with no collection renders its composer line unchanged.
6. Edit an existing piece: collection prefills, can be changed, and can be cleared back to
   empty.
7. Verify search by collection name returns the right pieces on both compact and wide
   layouts.
8. Verify the dropdown dismisses on outside tap and on selection.
