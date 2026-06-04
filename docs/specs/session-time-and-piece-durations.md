# Spec: Session Time & Piece Durations

## Phase 0: Handoff

**Spec file:** `docs/specs/session-time-and-piece-durations.md`

**Implementer instructions:**

- Use the **Phases** section (Phase 1–6) as the implementation plan.
- Build phases in order — later phases depend on earlier ones (data model before planner before UI).
- Run `yarn lint` and `yarn test` after each phase. Fix **all** issues, including pre-existing.
- All new UI strings go through i18n (`i18n/locales`). No hardcoded strings. Add localized `accessibilityLabel`/`accessibilityHint` to any new icon-only controls.
- Firestore: never write `undefined`. Optional fields that are unset must be `null`.
- Manually test via Playwright (login `senth.wallace@gmail.com` / `hellomynameispassword123`, local server `http://localhost:8081`).
- Never commit — the user reviews and commits manually.
- Respond in caveman ultra.
- After all phases verified working, close the tracking issue.

## 1. What

Three improvements to the existing session generator/coach (`utils/session-planner.ts`, `app/(app)/session/*`):

1. **Piece duration** — a `durationSeconds` field on pieces, set manually in the piece form or captured in-session (maintenance blocks only) from elapsed time. Feeds the maintenance planner.
2. **Maintenance picks many pieces** — the maintenance allotment is packed with as many pieces as fit (one full play-through each + 20% buffer), each as its own coach block, instead of dumping all the minutes on a single piece.
3. **Proportional time redistribution** — when a slot has no eligible content at plan-build time, its minutes are spread across the surviving blocks in proportion to their current allocation, instead of being dumped into one bucket.

## 2. Why

The maintenance block currently gives ~12 min to one piece — pedagogically wrong; maintenance means rotating many pieces, one clean run-through each. Durations let the planner fit the right number of pieces. Proportional redistribution keeps a session's intended shape when content is missing, rather than over-feeding whichever bucket happens to be first.

## 3. Data Model

### `models/piece.ts` — extend `Piece`

```typescript
export interface Piece {
  // …existing…
  durationSeconds?: number | null; // full play-through estimate; null if unknown
}
```

- **No** `durationSource` field, **no** playthrough-count field (deferred).
- `hooks/use-pieces.ts`:
  - `FirestorePiece` interface: add `durationSeconds?: number | null`.
  - `fromFirestore`: add `durationSeconds: data.durationSeconds ?? null`.
  - `useAddPiece.addPiece(...)` takes **positional args** today `(title, composer, state, targetTempoBpm)` — extend it to accept `durationSeconds: number | null = null` and write it in the `addDoc` payload.
  - `useUpdatePiece.updatePiece` uses a `Pick<Piece, …>` whitelist — **add `"durationSeconds"`** to it, or the update will be type-rejected.
- Firestore never accepts `undefined`; pass `null` when unset.

No other model changes. No new Firestore collections. Sessions stay ephemeral (AsyncStorage), as today.

## 4. Planner Logic

All in `utils/session-planner.ts`. `now`-injectable and deterministic, as the existing code is.

### 4.1 Maintenance: pick many (replaces `pickRepertoireMaintenance`)

New `pickRepertoireMaintenanceBlocks(pieces, budgetMinutes, now, usedPieceIds)` → `{ blocks: PlannedBlock[]; leftoverMinutes: number }`.

- Pool: `eligibleMaintenancePieces` (state `maintenance` | `performance`, not practiced today, not already used) — unchanged.
- Score & sort desc with existing formula (`days × stateWeight + bpmGap`), tie-break by title.
- **Per-piece cost (minutes):**
  - `piece.durationSeconds != null` → `max(1, Math.round((durationSeconds / 60) * 1.2))` (full play-through + 20% buffer).
  - else → `5` (default; no buffer applied to the guess).
- **Greedy packing:**
  - Walk pieces best-score-first. `remaining = budgetMinutes`.
  - **First (best) piece is always taken**, even if its cost exceeds `remaining` — allocate its **full cost** (the session may overrun; this guarantees long pieces still get maintained and that maintenance is never empty when eligible pieces exist). Then `remaining -= cost`.
  - For each subsequent piece: take it **only if `cost <= remaining`**; allocate full cost; `remaining -= cost`. The first piece that does not fully fit → **stop**.
  - `leftoverMinutes = max(0, remaining)`.
- Each block: `{ kind: "repertoire-maintenance", pieceId, allocatedMinutes: cost, title, subtitle: composer, score }`.

### 4.2 Leftover redistribution (maintenance)

`leftoverMinutes` from 4.1 is added to the **learning** and **stabilizing** blocks in proportion to their current `allocatedMinutes`. If only one exists, it gets all of it. If neither exists, the leftover is dropped (session runs slightly shorter). Use last-gets-remainder so the integer sum is exact.

### 4.3 Proportional empty-content redistribution (replaces `redistributeRepertoireForAvailability` **and** the technique-omit dump)

One pass over these slots: `technique`, `sightReading`, `repertoireLearning`, `repertoireStabilizing`, `repertoireMaintenance`. **Warmup is excluded** (kept as-is with its freeform fallback; its minutes are never redistributed).

- **Availability:**
  - `technique` available ⇔ ≥1 eligible technique (`active`/`maintenance`, not practiced today).
  - `sightReading` available ⇔ `alloc.sightReading > 0` (freeform timer — always runnable; needs no material).
  - `repertoireLearning` / `repertoireStabilizing` available ⇔ ≥1 eligible section candidate for that slot.
  - `repertoireMaintenance` available ⇔ ≥1 eligible maintenance piece.
- For every slot with `allocation > 0` but **not** available: add its minutes to a `freed` pool and zero the slot.
- Recipients = slots with `allocation > 0` **and** available. Distribute `freed` across recipients **proportional to their current (post-zeroing) allocation**. Integer split via last-gets-remainder so the total is conserved.
- If there are no recipients, `freed` is dropped (shorter/empty session).
- This is **build-time only**, for **empty content**. It does **not** change:
  - User-disabled domain switches → those minutes still dump to repertoire in `allocateTime` (unchanged; intentional choice).
  - Runtime **Skip** → still just ends the session earlier (no live redistribution).

**Worked example (the user's):** total 30, `tech 10 / read 5 / rep 15`; a 5-min slot is freed and the three above are the recipients → `tech += (10/30)×5 = 1.67`, `read += (5/30)×5 = 0.83`, `rep += (15/30)×5 = 2.5`. (Integerized; sum preserved.)

### 4.4 `buildPlan` order

1. `alloc = allocateTime(inputs)` (disabled domains already folded into repertoire — unchanged).
2. Compute availability flags (4.3).
3. Apply proportional redistribution (4.3) → updated `technique / sightReading / learning / stabilizing / maintenance` minutes. Record `omitted[]` entries for zeroed slots (reason `practiced-today` vs `no-content`) — keep this; the setup preview uses it.
4. Warmup block (unchanged).
5. Technique blocks via `pickTechnique(updatedTechnique, …)`.
6. Learning + stabilizing single blocks (updated minutes).
7. Maintenance: `pickRepertoireMaintenanceBlocks(updatedMaintenance, …)` → multiple blocks + leftover.
8. Apply 4.2 leftover bump to learning/stabilizing blocks.
9. Sight-reading block (updated minutes).
10. Assemble in `ORDER_BY_EMPHASIS`; the `repertoire-maintenance` slot now contributes the **array** of maintenance blocks (the `byKind` map already supports arrays — mirror the `technique` handling).

## 5. UI Flow

### 5.1 Piece form (`app/(app)/piece/add.tsx` + `app/(app)/piece/[id]/edit.tsx`)

- Add an optional **Duration** field (numeric, **minutes**), placed near target BPM.
- Save: `durationSeconds = minutes ? minutes * 60 : null`. Edit: prefill `Math.round(durationSeconds / 60)` when set, else blank.
- Validate like other numeric inputs (positive integer, inline error on bad input).

### 5.2 In-session duration prompt (coach) — **maintenance blocks only**

In `app/(app)/session/coach.tsx`, when advancing via **Save & next** from a block where:
`block.kind === "repertoire-maintenance"` **and** `block.pieceId` is set **and** that piece's `durationSeconds == null`

→ show a dialog **before** advancing:

```
Set duration for {pieceTitle}?
Measured: ~{mm:ss}        (block elapsed)
[ {minutes} ] min         (editable; prefilled round(elapsedSeconds/60), min 1)
[Skip]              [Save]
```

- **Save** → `updatePiece(pieceId, { durationSeconds: enteredMinutes * 60 })`, then advance.
- **Skip** → advance, write nothing.
- Read the piece's current `durationSeconds` via the cached `usePieces()` list (look up by `pieceId`).
- Does **not** fire on Skip-block (no play-through happened) or on learning/stabilizing/whole-piece-without-sections blocks.

### 5.3 Setup preview (`app/(app)/session/setup.tsx`)

The live "Estimated plan" preview must render the maintenance slot as **multiple lines** (one per picked piece) or a count — reflecting the new multi-block maintenance output and any redistribution.

### 5.4 Summary (`app/(app)/session/summary.tsx`)

Already lists blocks; verify it renders multiple maintenance lines and that totals (practiced vs allotted, skipped count) remain correct with the larger block count and possible overrun.

## 6. Logging

- No new log types. Each maintenance piece is its **own** `repertoire-maintenance` block → its **own** `PiecePractice` entry via the existing `useSavePractice` (`triggeredFrom: "session-coach"`, no `sectionId`). This already happens once maintenance emits separate blocks.
- `durationSeconds` written to the piece doc via `useUpdatePiece`.
- No duration source, no playthrough count, no redistribution-event logging (all deferred).

## 7. Out of Scope

- `durationSource` (manual vs measured) tracking.
- Playthrough-count input — assume 1 per maintenance piece.
- Duration prompt on non-maintenance blocks (learning/stabilizing whole-piece).
- Cross-day maintenance rotation cap (same-day repeat already blocked) — Phase 5.
- Runtime-Skip live redistribution; per-domain ceilings on redistribution.
- A future heuristic deciding **whether** to schedule maintenance at all (for now always pick ≥1 when eligible).
- Redistribution-event logging; persisting sessions to Firestore (stay ephemeral).
- m:ss input widget in the piece form (form uses whole minutes; in-session prompt shows measured as m:ss but edits minutes).

## 8. Phases

### Phase 1: Piece duration data model + form

- Add `durationSeconds?: number | null` to `models/piece.ts`; map it in `hooks/use-pieces.ts` `toPiece`.
- Add the optional Duration (minutes) field to `piece/add.tsx` and `piece/[id]/edit.tsx`; store `minutes * 60` or `null`; validate.
- i18n keys for the label/helper/validation.
- Tests: `toPiece` round-trip incl. null; form maps minutes↔seconds.

### Phase 2: Maintenance picks many (planner)

- Replace `pickRepertoireMaintenance` with `pickRepertoireMaintenanceBlocks` (§4.1): cost = `round(durationSeconds/60 × 1.2)` or `5`; greedy packing; first piece always taken (full cost even if over budget); stop on first non-fitting subsequent piece; return blocks + `leftoverMinutes`.
- `buildPlan`: emit maintenance as an array; apply leftover bump to learning/stabilizing (§4.2).
- Unit tests: single vs many; durations vs default-5; exact-fit; leftover→learning/stabilizing (and drop when neither); oversized first piece overruns; `usedPieceIds` no double-pick; deterministic order/tie-breaks.

### Phase 3: Proportional empty-content redistribution (planner)

- Implement §4.3 pass; delete `redistributeRepertoireForAvailability` and the technique-omit dump; keep `omitted[]` population.
- Unit tests: the worked example (tech10/read5/rep15, freed 5); single empty slot; multiple empty slots; technique-empty spreads cross-domain; all-repertoire-empty; no-recipients drop; integer-sum conservation; disabled-switch behavior unchanged.

### Phase 4: In-session duration prompt (coach)

- §5.2 dialog wired into the Save & next advance path for maintenance blocks with null duration; `updatePiece` on Save; advance on Skip.
- i18n keys; a11y labels on dialog buttons.

### Phase 5: Setup preview + summary

- §5.3 multi-piece maintenance preview; §5.4 summary verification with many maintenance blocks + overrun.
- i18n keys for any new strings.

### Phase 6: Lint, i18n, a11y, Playwright e2e

- `yarn lint` + `yarn test` green (fix pre-existing too).
- Playwright end-to-end:
  - Set a piece duration in the form; reopen edit → persists.
  - Maintenance with several eligible pieces → multiple maintenance blocks; minutes match durations×1.2 / 5-default; first piece taken even when oversized.
  - Leftover redistributes into learning/stabilizing (preview + coach).
  - Empty-content redistribution: no learning pieces → minutes spread proportionally (verify worked example sums).
  - In-session prompt appears only on maintenance whole-piece blocks with no duration; Save writes `durationSeconds`; Skip writes nothing.
  - Summary totals/skipped correct with the larger block count.
