# BPM Quick-Adjust Buttons

## What

Replace the bare BPM TextInput in every practice screen with a shared `BpmControl` component that adds four segmented quick-adjust button groups below the input field.

## Why

Typing into a number field during live practice is disruptive. Pianists need to nudge tempo up or down without breaking focus. Standard increments (±1 for fine tuning, ±5 / ±10 for Hanon/Czerny style stepping, halve/double for subdivision work) cover all real-world use cases.

## Data model

No Firestore changes. BPM state remains a string in each parent screen. Quick-adjust buttons call the parent's existing `onChangeText` handler — no new persistence layer.

_Start/end BPM logging triad (teacher recommendation) deferred to a future issue._

## UI flow

### BpmControl component layout

```
┌─────────────────────────────┐  ┌───────────┐
│         TextInput (BPM)     │  │ Metronome │
└─────────────────────────────┘  └───────────┘
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────────┐
│  −1 │+1 │ │  −5 │+5 │ │ −10 │+10 │ │   ½  │ ×2 │
└─────────┘ └─────────┘ └──────────┘ └───────────┘
[HelperText error if invalid]
```

- Four `SegmentedButtons` groups from react-native-paper (same library as `RatingField`)
- Buttons are **action-only** — no selection state, `value=""` always
- Buttons **always enabled mid-run** (metronome updates live via existing 150ms debounce)
- Buttons **disabled** when value is empty or non-numeric (can't do math)
- All adjustments **clamp to [20, 240]**
- Halve: `Math.round(n / 2)`, clamped to min 20
- Double: `Math.min(n * 2, 240)`

### Screens affected

1. `components/practice/SightReadingBlockBody.tsx`
2. `app/(app)/piece/[id]/practice.tsx`
3. `app/(app)/technique/[id]/practice.tsx`

_Soft prompt for >20 BPM jumps deferred to a future issue (requires logging triad first)._

## Logging

No new logging in this feature. Achieved BPM remains a separate, manually-entered field — never auto-updated from metronome adjustments.

## Out of scope

- Start/end BPM logging triad
- >20 BPM soft-prompt warning
- Disabling buttons while metronome runs
- Auto-updating achieved BPM from metronome changes
- ±2 increment (pedagogically unnecessary per teacher review)

## Phases

### Phase 1 — BpmControl component

Create `components/practice/BpmControl.tsx`:

```typescript
interface BpmControlProps {
  value: string;
  onChangeText: (text: string) => void;
  error: string | null;
  onBlur: () => void;
  stopRef?: React.MutableRefObject<(() => void) | null>;
  placeholder?: string;
}
```

- Renders TextInput + MetronomeButton row (MetronomeButton only if `stopRef` provided)
- Renders 4 `SegmentedButtons` groups below
- HelperText error below buttons
- Button click math: parse current value → apply delta → clamp → `onChangeText(result.toString())`
- Buttons disabled prop when `value.trim()` is empty or `isNaN(parseInt(value))`
- No internal state — fully controlled

### Phase 2 — Integrate into SightReadingBlockBody

- Replace existing `[TextInput | MetronomeButton] + HelperText` block with `<BpmControl>`
- Pass `bpm`, `handleChange`, `bpmError`, `onBlur`, `stopRef`
- Debounce-to-AsyncStorage logic stays in parent's `handleChange`

### Phase 3 — Integrate into piece and technique practice screens

- `app/(app)/piece/[id]/practice.tsx`: replace `[TextInput | MetronomeButton] + HelperText` with `<BpmControl value={achievedBpm} onChangeText={setAchievedBpm} ...>`
- `app/(app)/technique/[id]/practice.tsx`: same pattern with `tempoBpm` / `setTempoBpm`
- Parent validation and blur handlers unchanged

### Phase 4 — Tests + playwright E2E

- Run `yarn typecheck` and `yarn lint` — fix all issues
- Playwright: open sight-reading block, confirm buttons appear, click +5, verify BPM input updates, start metronome, click −1 mid-run, verify it still ticks
- Playwright: test halve/double at boundary values (40 → halve → 20, 200 → double → 240 not 400)
- Playwright: confirm buttons are disabled when BPM field is empty
