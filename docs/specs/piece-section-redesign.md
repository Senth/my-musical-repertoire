# Piece Section Redesign

## Phase 0: Handoff

- Spec path: `docs/specs/piece-section-redesign.md`
- Implementer: use the **Phases** section below as the implementation plan. No separate PLAN.md update mid-flight.
- After all phases verified working, check off the PLAN.md item: Phase 3 → "Piece section redesign" (and its sub-bullets, lines 179–184).
- Verification gates per project CLAUDE.md: `yarn lint` clean, `yarn test` green (fix all existing failures too), manual playwright pass on http://localhost:8081 with `senth.wallace@gmail.com` / `hellomynameispassword123`.
- Reference example: piece named **"Terra's theme"** — has target BPM with sections at working BPM; redesign must look good there.

## What

Redesign the piece detail screen's section list to surface progress at a glance, add a per-section Practice button, fix horizontal padding, expose hidden fields, and retire the separate Manage & Reorder sections page.

## Why

Students need to scan sections and act fast. Today: the row hides notes and override-BPM, the linear progress bar misleads (60/120 looks half-done but tempo difficulty is nonlinear), and "Manage & reorder" is a friction trip. Teacher-agent emphasized phase chip + BPM gap + last-practiced as the three loudest signals. MD3 review flagged inconsistent padding, weak page hierarchy, and underused row real estate.

## Data Model

`models/section.ts` — add field:

| Field | Type | Notes |
|---|---|---|
| `lastPracticed` | `Date \| null` | Updated when a practice log targets this section. Backfill not required — treat missing as never practiced. |

No other schema change. No Firestore migration needed.

## UI Flow

### Piece detail page hierarchy

1. Appbar — title + edit + delete (unchanged)
2. Composer + lifecycle state chip
3. **Practice button** (full-width contained) — promoted above metadata
4. Compact meta row: `last practiced · target BPM` (single line)
5. Notes (collapsible, unchanged behavior)
6. Sections block:
   - Header: `Sections` label + `⋮` overflow → menu with `Reorder sections`
   - List of section rows (new layout, see below)
   - Inline empty state with `Add section` button when none exist
7. FAB (+ section) (unchanged)

The standalone `manageSections` `List.Item` (link to `/piece/[id]/section`) is removed.

### Section row layout

```
┌──────────────────────────────────────────────────────────┐
│ Bridge        bars 33–48                          [▶]   │  bodyLarge + bodySmall · 40dp filled-tonal IconButton
│ [Stabilizing]  88 / 120 BPM · 3d ago                    │  phase chip + bpm + staleness
│ LH leaps in m. 40, memory still shaky…                  │  notes truncated ~40 chars, onSurfaceVariant
│ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░  4dp, sqrt scale, amber  │  omit when currentBpm null
└──────────────────────────────────────────────────────────┘
```

- Tap row → section detail (`/piece/[id]/section/[sectionId]`).
- Tap `▶` → `/piece/[id]/practice?sectionId=...&from=piece-detail`.
- Notes line absent when section has no notes.
- Progress bar absent when no `currentBpm` or no effective target BPM.
- Staleness uses existing `formatDaysAgo`; absent when never practiced.

### BPM progress visualization

- Fill = `sqrt(currentBpm / effectiveTargetBpm)` clamped 0..1 — so 60/120 renders ~71% (felt) not 50% (raw), matching tempo-difficulty nonlinearity.
- Color zones based on **raw ratio**:
  - `< 0.70` → red (theme `error`)
  - `0.70 – 0.90` → amber (custom warning tone)
  - `>= 0.90` → green (custom success tone or theme `tertiary`)

### Reorder mode

- Triggered from Sections-header `⋮` overflow → `Reorder sections`.
- Replaces the list with `DraggableFlatList`-style rows (compact, drag handle, no Practice button).
- Header swaps to `Done` action to exit reorder.
- Persists via existing `useReorderSections` hook.

### Archive

- Lives inside the section edit screen (`app/(app)/piece/[id]/section/[sectionId].tsx`).
- Outlined button with destructive tone, confirmation dialog, then `router.back()` to piece detail.
- Reuses `useArchiveSection`.

### Empty state (sections)

- Inline within the Sections block: icon (`music-note-outline`) + title `No sections yet` + body `Break the piece into practiceable chunks` + outlined `Add section` button.
- FAB still present.

## Logging

- On practice log save targeting a section, write `lastPracticed = serverTimestamp()` to that section doc.
- For whole-piece practice with section mistakes selected (existing flow), update each marked section's `lastPracticed`.
- No new log collection. Row-level staleness signal is read-only derivation.

## Out of Scope

- `lastPracticed` retroactive backfill from old practice logs.
- Per-block accuracy / effort / scope / tempo-achieved fields (separate PLAN.md item).
- Hands-separate flag, practice count, phase-transition nudges, recommendation engine signals.
- BPM bump suggestions / phase nudges.
- Whole-piece history / charts.
- PDF / sheet-music integration.
- Native mobile testing — web-only verification per current project stage.

## Phases

### Phase 1 — Data model: `lastPracticed` on Section

- Add `lastPracticed?: Date | null` to `models/section.ts`.
- Update `useSections` (`hooks/use-sections.ts`) read mapping to convert Firestore timestamp → Date.
- Hook into practice-log save paths (locate via `usePieces` / practice screens at `app/(app)/piece/[id]/practice.tsx`) so saving a session with a `sectionId` writes `lastPracticed` to that section.
- Confirm via Firestore inspection that field appears after a practice log.
- No migration needed for missing field.

### Phase 2 — `SectionDetailRow` redesign

- Rewrite `components/section/SectionDetailRow.tsx`:
  - Layout: label + bars line, phase chip + BPM + staleness line, notes-truncated line, progress bar.
  - Add filled-tonal `<IconButton icon="play">` aligned right on the label line. `onPress` triggers practice route; must stop propagation.
  - Helper `bpmProgressColor(ratio)` → red / amber / green (theme tokens).
  - Helper `bpmProgressFill(ratio)` → `Math.sqrt(ratio)` clamped.
  - Use `formatDaysAgo` from `utils/date.ts` for staleness.
  - Handle null cases silently.
  - Accessibility: row press has `accessibilityRole="button"`; Practice button has localized label.
- Add i18n keys: `section.practiceLabel`, `section.staleness.never`, etc.

### Phase 3 — Piece detail page restructure

- Edit `app/(app)/piece/[id]/index.tsx`:
  - Move Practice button above metadata.
  - Compact metadata into a single `bodyMedium` line.
  - Remove the `manageSections` `<List.Item>`.
  - Add Sections header row: label on left, `IconButton icon="dots-vertical"` on right with `Menu` → `Reorder sections`.
  - Implement reorder mode toggle: when active, swap list rows for compact drag rows (reuse `DraggableFlatList` + the existing `useReorderSections`). Exit via "Done" in header (replace ⋮ with text button while active).
  - Inline empty state with Add section button.

### Phase 4 — Section edit screen: Archive

- Edit `app/(app)/piece/[id]/section/[sectionId].tsx`:
  - Add outlined Archive button (destructive tone) below the form.
  - Confirmation dialog (reuse the wording from old manage page).
  - Hook into `useArchiveSection`; on success, `router.back()`.
  - i18n: reuse existing `screen.pieceSections.archiveDialog.*` keys.

### Phase 5 — Cleanup

- Delete `app/(app)/piece/[id]/section/index.tsx`.
- Delete `components/section/SectionListItem.tsx` if unused after Phase 3 (verify via grep).
- Remove orphan i18n keys (`screen.pieceSections.title`, `subtitle`, etc. that only the deleted page used).
- Run `yarn lint` and `yarn test`; fix all issues (including pre-existing ones per CLAUDE.md).

### Phase 6 — Padding + polish pass

- Audit piece detail at narrow (375px) and wide (1280px) on web.
- Decide row container approach: edge-bleed rows with internal `px-4`, header/notes wrap in `px-4` — confirm alignment.
- Snapshot via playwright into `$PWD/.tmp/`.

### Phase 7 — End-to-end testing (playwright)

- Launch playwright skill against http://localhost:8081.
- Log in with test creds.
- Test cases:
  1. Piece **Terra's theme** with target BPM + sections at varied working BPM — confirm color zones render (find one section in each of red/amber/green if available; otherwise create test data).
  2. Piece without target BPM → progress bar absent, BPM line shows currentBpm only.
  3. Section without currentBpm → no progress bar, no BPM number, phase chip only.
  4. Empty sections list → inline empty state visible.
  5. Tap row → section detail navigation.
  6. Tap ▶ → practice screen with sectionId param.
  7. Toggle reorder → drag → persist → exit.
  8. Archive from section edit → returns to piece detail, row gone.
  9. Tap Practice on piece (top button) → flow unaffected.
- Screenshots into `$PWD/.tmp/`.
- Final: `yarn lint`, `yarn test` green; check off PLAN.md sub-items.
