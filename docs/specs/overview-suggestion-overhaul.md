# Phase 0: Handoff

**Spec:** `docs/specs/overview-suggestion-overhaul.md`

Use the **Phases** section below as your implementation plan.

Tracking: GitHub Issues + Kanban board (no PLAN.md).

---

# Overview Suggestion Overhaul

## What

Replace the ad-hoc `getSuggestedPieces`/`getSuggestedTechniques` functions in the overview with the same score-based ranking used by the session plan generator, extracted into a shared scoring module so both consumers stay in sync.

## Why

The current overview suggestion logic uses simple recency + mistake sorting. The session planner has a richer scoring formula (phase weight × days-since + BPM gap) that better prioritizes what actually needs attention. Reusing the same logic ensures the overview and session planner agree on urgency, and prevents the two from drifting independently.

## Data Model

No Firestore schema changes. New fields used:
- `Piece.lastPracticed` — already exists
- `Piece.lastAchievedTempoBpm`, `Piece.targetTempoBpm` — already exist
- `Section.lastPracticed`, `Section.currentBpm`, `Section.phase` — already exist (used for learning/stabilizing)
- `TechniqueItem.lastPracticedAt`, `TechniqueItem.lastEffort`, `TechniqueItem.lastQuality` — already exist

## UI Flow

### Piece suggestions

All suggestions appear in a single flat list under the existing "Suggested Practices" header (no per-category sub-headers). Cards already show a lifecycle state chip so the category is visible.

**Order within the list:** Learning → Stabilizing → Performance → Maintenance (by score within each category).

**Counts (caps, not fixed):**
- Max 1 Learning piece
- Max 1 Stabilizing piece
- Max 2 Performance pieces
- Max 2 Maintenance pieces

Empty categories are silently omitted — no placeholder cards.

**Empty state variants (pieces section):**

| Condition | Message |
|---|---|
| `pieces.length === 0` | "Start by adding a piece to your repertoire." |
| All active pieces practiced today | "Wow! You have practiced all your pieces today. Take a rest or add new pieces to practice!" |
| All pieces are in maintenance state (none practiced today) | "All your pieces are in maintenance. Consider adding a new piece to learn!" |

"Active pieces" for the all-done check = pieces not in `on_hold` or `shelved`.

### Technique suggestions

Same flat list under existing "Techniques Today" header. State chip visible on each card.

**Counts (caps):**
- Max 2 Active techniques
- Max 2 Maintenance techniques

**Empty state (techniques section):**

| Condition | Message |
|---|---|
| No active or maintenance techniques | (already handled — show nothing) |
| All eligible techniques practiced today | "You've practiced all your techniques today!" |

### Reason text

Each card shows a short reason line explaining *why* it was suggested. Computed alongside scoring and returned as an i18n key + interpolation args (not derived from the Piece/Technique directly in the component).

**Pieces:**
- Never practiced: `"New piece — start your first session"`
- BPM gap dominant (gap > days × phaseScore): `"{{gap}} BPM below target"` 
- Default: `"{{days}} day(s) since last practice"`

**Techniques:**
- Never practiced: `"New — practice for the first time"`
- Effort/quality dominant: `"Effort or quality needs work"`
- Default: `"{{days}} day(s) since last practice"`

## Scoring

### Shared scoring module: `utils/planner-scoring.ts`

Extract from `session-planner.ts` into a new file:
- `daysSince(date, now)` — returns 999 for null (covers never-practiced pieces)
- `scoreSectionCandidate(piece, phase, lastPracticed, currentBpm, now)` — learning/stabilizing
- `scoreMaintenancePiece(piece, now)` — performance/maintenance
- `scoreTechnique(tech, now)` — technique scoring

`session-planner.ts` imports these from `planner-scoring.ts` instead of defining them inline.

### `utils/overview-suggestions.ts`

New file. Uses functions from `planner-scoring.ts`.

```ts
export interface SuggestedPiece {
  piece: Piece;
  score: number;
  reasonKey: string;        // i18n key
  reasonParams: Record<string, unknown>;
}

export interface SuggestedTechnique {
  tech: TechniqueItem;
  score: number;
  reasonKey: string;
  reasonParams: Record<string, unknown>;
}

export interface PieceSuggestions {
  suggestions: SuggestedPiece[];
  emptyStateKey: string | null;   // null = has suggestions
}

export interface TechniqueSuggestions {
  suggestions: SuggestedTechnique[];
  emptyStateKey: string | null;
}

export function suggestPieces(
  pieces: Piece[],
  sections: Section[],
  now: Date,
): PieceSuggestions

export function suggestTechniques(
  techniques: TechniqueItem[],
  now: Date,
): TechniqueSuggestions
```

**`suggestPieces` logic:**
1. Filter out `on_hold` and `shelved` pieces.
2. Determine empty state (see table above) before scoring.
3. For learning + stabilizing: use `buildSectionCandidates` (section-aware) → pick highest-scoring section per piece → score represents the piece.
4. For performance + maintenance: use `scoreMaintenancePiece` per piece.
5. Exclude pieces where `isPracticedToday(piece.lastPracticed, now)`.
6. Sort each category by score descending. Take top 1 / 1 / 2 / 2.
7. Emit `emptyStateKey: null` when any suggestions exist.

**`suggestTechniques` logic:**
1. Filter `retired` out.
2. Eligible = not practiced today.
3. Sort active by `scoreTechnique` → top 2.
4. Sort maintenance by `scoreTechnique` → top 2.
5. Emit `emptyStateKey` if no eligible techniques (all done today) vs no techniques at all.

### `overview.tsx` changes

- Add `useAllSections()` hook (already exists in `hooks/use-sections.ts`).
- Replace `getSuggestedPieces` + `getSuggestedTechniques` with calls to `suggestPieces` / `suggestTechniques`.
- Render `reasonKey`/`reasonParams` via `t(reasonKey, reasonParams)` on each card.
- Render `emptyStateKey` message when present.

## Logging

No new logging. Overview is read-only; existing practice logging is unchanged.

## Out of Scope

- Session duration awareness in overview (show all suggestions regardless of how long they'd take)
- Per-category sub-headers in the overview list
- BPM bump suggestions
- Deadline / priority flags on pieces

## Phases

### Phase 1: Extract scoring into `utils/planner-scoring.ts`

- Create `utils/planner-scoring.ts` exporting: `daysSince`, `scoreSectionCandidate`, `scoreMaintenancePiece`, `scoreTechnique`, `buildSectionCandidates`, `eligibleMaintenancePieces`, `eligibleTechniquesInState`, `sortTechniques`.
- Update `utils/session-planner.ts` to import these from the new file (no behavioral change).
- Update/add unit tests in `utils/session-planner.test.ts` to cover scoring functions directly.
- Run all tests; fix any failures.

### Phase 2: Build `utils/overview-suggestions.ts`

- Implement `suggestPieces` and `suggestTechniques` per spec above.
- Unit tests covering: empty-state variants, cap logic (max 1L/1S/2P/2M), never-practiced boost (daysSince=999), all-maintenance nudge, reason text output.
- Run all tests.

### Phase 3: Wire into `overview.tsx`

- Add `useAllSections()` to overview.
- Replace `getSuggestedPieces` / `getSuggestedTechniques` with `suggestPieces` / `suggestTechniques`.
- Add i18n keys for new reason strings and empty-state messages.
- Render reason line on each piece card and each technique card.
- Render empty state messages.
- Run lint + tests.

### Phase 4: E2E verification with Playwright

- Test: overview loads and shows suggested pieces (login as test user).
- Test: reason text visible on at least one card.
- Test: empty state message visible when all pieces practiced today (if achievable with test data).
- Fix any visual issues found.
