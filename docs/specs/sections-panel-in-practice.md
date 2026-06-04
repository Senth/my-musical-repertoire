# Spec: Sections Panel in Piece Practice Screen

## Phase 0: Handoff

**Spec file:** `docs/specs/sections-panel-in-practice.md`

**Implementer instructions:**
- Use the Phases section (Phase 1–6) as your implementation plan.
- Tracking: GitHub Issues + Kanban board (no PLAN.md).
- Run `yarn lint` after each phase. Fix all issues including pre-existing ones.
- Manual testing via playwright skill (login: senth.wallace@gmail.com / hellomynameispassword123, local server at http://localhost:8081).
- Never commit — user reviews and commits manually.
- Respond in caveman ultra.

## 1. What

Add a sections panel to the piece practice screen — displayed between Memory mistakes and Save button — showing all sections with phase chip, BPM progress, optional notes, and a Practice button. When mistakes ≥ some, the panel switches to a checkbox mode so the student can flag problematic sections before saving.

## 2. Why

A student who runs through the full piece and makes mistakes needs to immediately identify and drill the weak spots. The current screen offers no visibility into per-section progress during practice, and no structured way to flag problem areas. This panel:

- Surfaces section progress (phase + BPM gap) without leaving the practice flow
- Lets the student navigate directly to a focused section practice session
- Captures which sections caused problems, feeding the future recommendation engine
- Replaces the existing modal section picker (which was only marginally useful and creates two competing UIs)

## 3. Data Model

### `PiecePractice` document (Firestore: `users/{uid}/pieces/{pieceId}/practices/{id}`)

Add two new fields:

```typescript
flaggedSectionIds?: string[] | null   // sections student marked as problematic
triggeredFrom?: 'full-piece' | 'section-panel' | 'direct'  // how the practice was initiated
```

Updated `PiecePractice` interface in `models/practice.ts`:

```typescript
export interface PiecePractice {
  id?: string;
  pieceId: string;
  date: Date;
  technicalMistakes: PracticeMistakes;
  memoryMistakes: PracticeMistakes;
  achievedBpm?: number | null;
  sectionId?: string | null;
  flaggedSectionIds?: string[] | null;
  triggeredFrom?: 'full-piece' | 'section-panel' | 'direct';
}
```

No Firestore schema migration needed — new fields are additive and nullable.

## 4. UI Flow

### Full-piece practice screen (`/piece/[id]/practice`)

**REMOVED:**
- `List.Item` at top (section picker that opens RadioButton modal)
- `Modal` with `RadioButton.Group` for section selection
- The `selectedSectionId` state that drove the top picker

**LAYOUT AFTER:**

```
Piece title + composer + last practiced

────────────────────
BPM input + Metronome button

────────────────────
Technical mistakes  (SegmentedButtons)

Memory mistakes     (SegmentedButtons)

────────────────────
Sections panel      ← NEW (hidden if piece has no sections)

Save button
```

### Sections panel — normal mode (mistakes < some)

```
Sections
────────────────────────────────────────────
Bridge  [learning]     72 / 96 BPM   [Practice →]
          LH leaps
Coda    [stabilizing]  60 / 96 BPM   [Practice →]
Intro   [maintenance]  96 / — BPM    [Practice →]
          Memory insecure
```

- Section label + phase chip (colored)
- BPM line: `currentBpm / targetBpm BPM`
  - `targetBpm` = `section.targetBpmOverride` if set, else `piece.targetTempoBpm`
  - Missing value shown as `—`
  - If both are null: BPM line hidden
- Notes shown as subtitle when `section.notes` is non-empty
- `[Practice →]` button navigates to `/piece/[id]/practice?sectionId=[sectionId]&from=[original-from]`

### Sections panel — checkbox mode (mistakes ≥ some)

Activates when `technicalMistakes >= PracticeMistakes.some OR memoryMistakes >= PracticeMistakes.some`.

Header changes to: **"Sections — tap the ones that were problematic"**

Each row gains a checkbox on the left. `[Practice →]` button remains.

```
Sections — tap the ones that were problematic
────────────────────────────────────────────
[☐] Bridge  [learning]     72 / 96 BPM   [Practice →]
[☑] Coda    [stabilizing]  60 / 96 BPM   [Practice →]
[☐] Intro   [maintenance]  96 / — BPM    [Practice →]
```

Checked section IDs are included in `flaggedSectionIds` when Save is pressed.

### Section-scoped practice (navigated to from panel)

Same `/piece/[id]/practice` screen, but `sectionId` passed as a query param. The screen:
- Pre-selects that section (BPM prefills from `section.currentBpm`)
- `triggeredFrom` = `'section-panel'` on save

### Full-piece practice save

On Save:
- `triggeredFrom` = `'full-piece'`
- `flaggedSectionIds` = checked section IDs (empty array if checkbox mode not triggered or none checked)

### PracticeComparison screen

No changes in this feature. Flagged sections are recorded in Firestore but not yet surfaced in the comparison UI (deferred to Phase 4 recommendation engine).

## 5. Logging

Per practice save, the Firestore document captures:

| Field | When set | Purpose |
|---|---|---|
| `flaggedSectionIds` | Full-piece practice when sections exist | Feed recommender: which sections need attention |
| `triggeredFrom` | Every save | Recommender: distinguish proactive drill vs error-driven drill |

## 6. Out of Scope

- `focusType` field (accuracy / tempo-building / continuity / memory) — deferred to per-block logging phase
- Duration estimate per section — deferred
- "Fixed" resolution state per flagged section — deferred
- Showing flagged sections in PracticeComparison — deferred to Phase 4
- Surfacing flagged sections in Overview / session planner — deferred to Phase 4

## 7. Phases

### Phase 1: Data model + hook updates

- Update `models/practice.ts`: add `flaggedSectionIds` and `triggeredFrom` to `PiecePractice` interface
- Update `hooks/use-practices.ts` `savePractice` to accept and write `flaggedSectionIds` and `triggeredFrom`
- Update `app/(app)/piece/[id]/practice.tsx`: pass `triggeredFrom: 'full-piece'` on save; remove `selectedSectionId` state from the full-piece flow (top picker gone)

### Phase 2: Sections panel component

- Create `components/practice/SectionsPracticePanel.tsx`
  - Props: `sections: Section[]`, `piece: Piece`, `mistakeLevel: 'normal' | 'checkbox'`, `flaggedIds: string[]`, `onToggleFlag: (id: string) => void`, `onPractice: (sectionId: string) => void`
  - Renders section rows with: label, phase chip, BPM line (`currentBpm` / effective target), optional notes subtitle
  - `mistakeLevel === 'checkbox'`: shows checkbox on each row; changes header text
  - Phase chip colors: `learning` = primary, `stabilizing` = secondary, `maintenance` = tertiary (use theme tokens)
  - Hidden entirely when `sections` is empty

### Phase 3: Wire panel into practice screen

- Remove `List.Item` section picker, `Modal`, `RadioButton.Group`, `sectionPickerVisible` state, `selectedSectionId` state
- Add `flaggedSectionIds: string[]` state
- Add `showCheckboxes` derived value: `technicalMistakes >= PracticeMistakes.some || memoryMistakes >= PracticeMistakes.some`
- Render `<SectionsPracticePanel>` between Memory mistakes and Save button
- `onPractice` handler: navigate to `/piece/${id}/practice?sectionId=${sid}&from=${from ?? 'overview'}`
- Pass `triggeredFrom: 'full-piece'` + `flaggedSectionIds` to `savePractice`

### Phase 4: Section-scoped practice wires `triggeredFrom`

- In `practice.tsx`, detect `sectionId` query param
- When `sectionId` present: pass `triggeredFrom: 'section-panel'` on save
- Ensure BPM prefills from section's `currentBpm` (already works via existing `useEffect`)

### Phase 5: i18n + a11y

- Add all new translation keys (section panel header, checkbox mode header, BPM format strings, phase chip labels)
- Add `accessibilityLabel` to phase chips and checkbox rows
- Verify no hardcoded strings

### Phase 6: Tests + playwright verification

- Run `yarn lint` and fix all issues
- Manual test via playwright:
  - Piece with sections: panel visible, BPM values correct, phase chips shown, notes shown
  - Piece with no sections: panel hidden
  - Mistakes < some: no checkboxes shown
  - Mistakes ≥ some: checkboxes appear, can check/uncheck
  - Practice button navigates to section-scoped screen with correct prefill
  - Save records `flaggedSectionIds` and `triggeredFrom` in Firestore (verify via browser devtools / Firebase console)
  - Section-scoped save records `triggeredFrom: 'section-panel'`
