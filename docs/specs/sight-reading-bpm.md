# Sight-Reading BPM Component

## What

Add a BPM input + metronome button to the sight-reading block in the session coach, with the last-used BPM saved locally so the next session pre-fills it.

## Why

Sight-reading practice benefits from metronome use at a comfortable reading tempo. The screen is currently blank content (just a label), leaving the user with no tools during this block. Storing the last-used reading BPM as a local preference reduces friction across sessions.

This BPM is a **reading convenience tempo** — it must not be stored in Firestore or conflated with `piece.lastAchievedTempoBpm`.

## Data Model

No Firestore changes.

New AsyncStorage key (follows existing pattern in `utils/session-storage.ts`):

```
sight-reading-bpm:{uid}   →  string (numeric BPM, e.g. "72")
```

New functions in `utils/session-storage.ts`:
- `readSightReadingBpm(uid): Promise<string | null>`
- `writeSightReadingBpm(uid, bpm: string): Promise<void>`

## UI Flow

Screen: `sight-reading` block in `/session/coach.tsx` → rendered via `FreeformBlockBody`.

Replace `FreeformBlockBody` for `sight-reading` with a new `SightReadingBlockBody` component:

```
┌─────────────────────────────────────┐
│                                     │
│  [existing label text]              │
│                                     │
│  ┌──────────────┐  ┌─────────────┐  │
│  │  BPM: [  ]  │  │  ▶ Start    │  │
│  └──────────────┘  └─────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

- BPM TextInput + `MetronomeButton` side-by-side (same pattern as practice screen)
- On mount: load saved BPM from AsyncStorage, pre-fill field (empty if none)
- On change (debounced ~500ms): save to AsyncStorage
- On block advance (Save & Next / Skip): auto-stop metronome via `stopRef`

## Logging

None. Sight-reading sessions are free-form and should not produce `PiecePractice` records. The BPM preference is a UX convenience only.

## Out of Scope

- Per-piece sight-reading BPM (sight-reading blocks have no `pieceId`)
- Logging sight-reading activity to Firestore
- Learning phase nudges on the sight-reading screen
- "Go to practice" button (sight-reading blocks are not tied to a specific piece)
- Any changes to the piece detail screen or standalone practice screens

## Phases

### Phase 1: Storage utility

Add `readSightReadingBpm` / `writeSightReadingBpm` to `utils/session-storage.ts`. Add unit tests alongside existing tests in `utils/session-storage.test.ts`.

### Phase 2: SightReadingBlockBody component

Create `components/practice/SightReadingBlockBody.tsx`:
- Loads saved BPM on mount (via the new storage utils + `useAuth`)
- BPM TextInput (numeric, same validation: 20–240 or empty)
- `MetronomeButton` with `stopRef`
- Debounced auto-save on BPM change
- Exposes `stopRef` so the coach can stop the metronome on advance

### Phase 3: Wire into coach

In `coach.tsx`, replace the `sight-reading` case from `FreeformBlockBody` to `SightReadingBlockBody`. Pass a `stopRef` from the coach so metronome stops on `advance()`.

### Phase 4: End-to-end verification with Playwright

- Log in, start a session with sight-reading enabled
- Navigate to sight-reading block
- Enter BPM, start metronome
- Advance to next block → verify metronome stopped
- Return to sight-reading block in a new session → verify BPM pre-fills
