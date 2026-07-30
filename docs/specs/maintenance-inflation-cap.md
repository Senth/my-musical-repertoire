# Spec: Maintenance Inflation Cap + Oversized-Piece Opt-In

Tracking issue: [#47](https://github.com/Senth/my-musical-repertoire/issues/47)

## 1. What

A generated session may run at most **3 minutes longer** than the minutes the user asked for, and only ever because of maintenance. If the best-scored maintenance piece would blow past that cap, the planner picks the next-best piece that fits and offers the oversized one in the setup preview as an explicit **opt-in checkbox** — the user decides whether to spend the extra time. The setup preview shows the real resulting total, and all block minutes become fractional internally while displaying as rounded values (`~4 min`; exact values show `4 min`).

## 2. Why

Today `pickRepertoireMaintenanceBlocks` always takes its best-scored piece at **full cost, even when it exceeds the budget** (`utils/session-planner.ts:324`). A 12-minute piece turns a requested 30-minute session into 41 minutes with no warning — the time the user picked simply does not add up (issue #47).

Two rejected alternatives, and why:

- **Shrink the other blocks to pay for maintenance.** Rejected on pedagogy: maintenance is the lowest-value slot in a session. Learning a new section beats stabilizing one beats a clean run of a polished piece. Cutting learning or technique to fund a maintenance run-through inverts the priority ladder.
- **Never schedule an oversized piece at all.** Rejected on product: the user keeps maintenance pieces specifically to *finish on something simpler* and to *make sure every learnt piece stays remembered*. Silently skipping long pieces forever defeats both. The user knows their own schedule; the app should surface the choice, not make it.

A partial run-through is not an option — maintenance trains unbroken performance continuity, so a half play-through trains nothing maintenance is for. It is all-or-nothing per piece.

## 3. Data Model

No Firestore changes. Sessions stay ephemeral (AsyncStorage).

### `models/session.ts`

```typescript
export interface MaintenanceOptIn {
  pieceId: string;
  title: string;
  subtitle?: string | null;        // composer
  costMinutes: number;             // full cost of the piece (fractional)
  extraMinutes: number;            // cost - maintenance budget = resulting inflation
  daysSinceLastPracticed: number;  // 999 when never practiced
}

export interface SessionPlan {
  // …existing…
  /** Maintenance minutes beyond the maintenance budget. 0 when nothing overran. */
  inflationMinutes?: number;
  /** The best-scored eligible maintenance piece that cannot fit, offered as opt-in. */
  maintenanceOptIn?: MaintenanceOptIn | null;
}
```

`SessionPlan.totalMinutes` keeps its current meaning — the **requested** minutes, clamped 15–90. The real length is `totalMinutes + inflationMinutes`, exposed by one helper so no screen re-derives it:

```typescript
// utils/session-planner.ts
export function planTotalMinutes(plan: SessionPlan): number {
  return plan.totalMinutes + (plan.inflationMinutes ?? 0);
}
```

Both new fields are optional so `ActiveSession` values already in AsyncStorage keep deserializing (`inflationMinutes ?? 0`).

`SessionInputs` is **unchanged** — the opt-in is not persisted (see §5.3).

## 4. Planner Logic

All in `utils/session-planner.ts`. Deterministic and `now`-injectable, as today.

### 4.1 Fractional minutes

Every allocation becomes a real number; rounding happens only at display time.

- `allocateTime`: drop `Math.round` on tech/read/rep; the leftover reconciliation keeps its shape but no longer needs integer patching.
- `splitRepertoire`: exact 55 / 30 / 15 (and 65 / 35). The `< 7` and `< 12` **thresholds are unchanged**.
- `redistributeForAvailability` and `applyMaintenanceLeftover`: exact proportional shares; the last-gets-remainder integer juggling goes away.
- `maintenanceCost(piece)`: `Math.max(1, (durationSeconds / 60) * 1.2)` — no rounding. Unknown duration still costs a flat `5`.
- `pickTechnique`: per-technique minutes = `slotMin / count` exactly (no remainder-to-first-block). The `count` heuristics (`floor(slotMin / 5)`, the 3-min-per-technique floor) are unchanged and still evaluated on the fractional slot value.

Display is already handled by `utils/format-minutes.ts` (`displayMinutes`, `minutesLabelKey`) — rounds to whole minutes, flags the value approximate when rounding moved it, and never renders `0 min` for a block that has time. Timers keep using real seconds (`allocatedMinutes * 60`), so fractions cost nothing at runtime.

### 4.2 The inflation cap

```typescript
export const MAINTENANCE_INFLATION_CAP_MINUTES = 3;
```

The cap applies to the **whole maintenance group**, not per piece: the sum of all maintenance block costs may exceed the maintenance budget by at most 3 minutes. Per-piece capping would let three packed pieces push a session 9 minutes long, which is the bug being fixed.

`allowance = budgetMinutes + MAINTENANCE_INFLATION_CAP_MINUTES`. A piece landing exactly on the allowance **is** taken (inclusive).

### 4.3 Packing (replaces the "first piece always taken" rule)

`pickRepertoireMaintenanceBlocks(pieces, budgetMinutes, now, usedPieceIds, options?)` returns `{ blocks, leftoverMinutes, inflationMinutes, optIn }`.

- Pool and scoring are unchanged (`eligibleMaintenancePieces`, `scoreMaintenancePiece`, tie-break by title).
- Walk the pool best-score-first, tracking `used`. Take a piece when `used + cost <= allowance`; otherwise **skip it and keep scanning** the rest of the pool.
  - This is the behavioural change: the old rule took the best piece unconditionally (`i > 0 && cost > remaining`), and stopped at the first piece that did not fit. Skip-and-continue is what "pick the next-best piece that fits" means, and it also packs the remaining minutes better.
- `inflationMinutes = max(0, used - budgetMinutes)`.
- `leftoverMinutes = max(0, budgetMinutes - used)` — flows to learning/stabilizing exactly as today (`applyMaintenanceLeftover`).
- `optIn` = the highest-scoring eligible piece that was **not** picked and whose own cost exceeds `allowance` (i.e. it can never fit, not merely crowded out by earlier picks). `null` when `budgetMinutes <= 0` (see §4.5) or when no such piece exists.

Worked example — budget 8, cap 3, allowance 11; pieces A=6, B=4, C=3:

```
A 6  -> used 6   (<= 11) take
B 4  -> used 10  (<= 11) take
C 3  -> used 13  (>  11) skip
-> maintenance 10 min, inflation 2 min, leftover 0
```

### 4.4 Forced pick (the opt-in)

`options.forcedMaintenancePieceId` makes the named piece the **only** maintenance block, at full cost — a swap, not an addition:

- `blocks = [that piece]`, `inflationMinutes = max(0, cost - budgetMinutes)`, `leftoverMinutes = 0`, `optIn = null`.
- The piece must still be in the eligible pool; if it is not (practiced today, wrong state, already used by another slot), the option is ignored and normal packing runs.

Ticking the box **rebuilds the whole plan** rather than patching the maintenance block. This matters in the no-piece-fits case: those maintenance minutes had been handed to learning/stabilizing as leftover, and the rebuild takes them back so the preview stays honest.

End-of-session energy is low, so one clean run of one chosen piece is the right ask — adding the oversized piece *on top* of the auto-picked group would turn a 3-minute slot into 17 minutes.

### 4.5 No maintenance budget

When the maintenance allocation is 0 — short sessions where repertoire falls under the 12-minute threshold, or the slot was zeroed for lack of content — there is **no maintenance block and no opt-in row**. A 15-minute session is not the place to offer a 14-minute piece.

### 4.6 `buildPlan`

Signature gains a trailing options argument:

```typescript
buildPlan(inputs, pieces, sections, techniques, now?, options?: { forcedMaintenancePieceId?: string | null })
```

Order is otherwise unchanged (allocate → availability → redistribute → warmup → technique → learning/stabilizing → maintenance → leftover bump → sight-reading → assemble). It sets `inflationMinutes` and `maintenanceOptIn` on the returned plan from the maintenance pack result.

## 5. UI Flow

### 5.1 Setup preview total (`app/(app)/session/setup.tsx`)

The slider keeps showing the requested minutes. A total row closes the preview list so the plan reads as a receipt that adds up:

```
Total minutes        30 min
[=========|--------]

Estimated plan
  Technique       7 min
  Sight-reading   4 min
  Learning       10 min
  Stabilizing     6 min
  Maintenance     6 min — Prelude in E
  ────────────────────────
  Total          33 min  (+3)
```

The `(+N)` suffix appears only when `inflationMinutes > 0`.

### 5.2 Opt-in row

Rendered below the preview, only when `plan.maintenanceOptIn` is set. A `Checkbox.Item` (single offer — a radio group of one would be overkill), naming the piece and the extra minutes:

```
Maintenance     3 min — Etude Op.10/3

[x] Practice Sonata in G instead   (+11 min)
    [14 days]
```

- Ticking it re-plans with `forcedMaintenancePieceId` and the total row updates live (30 → 41).
- `+N min` is `optIn.extraMinutes` — the resulting inflation over the requested minutes.
- **Escalation** by `optIn.daysSinceLastPracticed`: `>= 14` renders an accent-coloured badge with the day count; `>= 21` renders the stronger "3 weeks — consider scheduling it" wording. This is one conditional style on an existing row and needs no new data — `lastPracticed` already carries the signal. Without it, the long pieces the user specifically wants to keep remembered depend on the user noticing them.
- `accessibilityLabel` / `accessibilityHint` on the checkbox, localized.

### 5.3 Opt-in lifetime

Plain screen state. Any change to minutes, emphasis or a domain toggle re-plans and clears the tick — the oversized piece may be a different one. Nothing is written to AsyncStorage: deciding fresh each session *is* the feature. Once the piece is practiced its `lastPracticed` resets, its score drops, and it re-enters normal packing on its own.

### 5.4 Screens reading the real total

All switch from `plan.totalMinutes` to `planTotalMinutes(plan)`:

- `session/coach.tsx` — the session progress bar's denominator (`sessionTotalSeconds`).
- `session/summary.tsx` — "Total practiced: 33 of 33 min". Reading "33 of 30" would look like an error.
- `(tabs)/overview.tsx` — the resume banner's minute count.

### 5.5 i18n

New keys under `screen.session`:

| Key | Copy |
|---|---|
| `setup.totalLabel` | `Total` |
| `setup.totalInflated` | `{{minutes}} min (+{{extra}})` |
| `setup.optIn.label` | `Practice {{piece}} instead` |
| `setup.optIn.extra` | `+{{minutes}} min` |
| `setup.optIn.a11y` | `Practice {{piece}} instead, adds {{minutes}} minutes` |
| `setup.optIn.staleDays` | `{{days}} days` |
| `setup.optIn.staleWeeks` | `3 weeks — consider scheduling it` |

`block.minutesApprox` (`~{{minutes}} min`) already exists.

## 6. Logging

No new logs. Each maintenance piece remains its own block and writes its own `PiecePractice` via `useSavePractice` (`triggeredFrom: "session-coach"`, no `sectionId`) — the opt-in swap changes *which* piece that is, nothing else.

## 7. Out of Scope

- **Configurable or dynamic cap.** 3 minutes flat, hardcoded. Scaling it by session length, or letting the user set it, is a later call.
- **Shrinking other blocks** to fund maintenance — rejected in §2, not a fallback.
- **Partial play-throughs** of an oversized piece.
- **More than one opt-in row.** Only the best-scored non-fitting piece is offered.
- **Persisting the opt-in** across sessions.
- **Known gap — freshly promoted maintenance pieces.** A piece just promoted from stabilizing still has rough edges and is a poor "finish strong" choice. There is no `promotedToMaintenanceAt` field; a future cooldown (~4 sessions) would fix it.
- **Known gap — declined opt-ins are a signal.** Repeatedly ignoring a specific piece tells the recommendation engine something (too hard? wrong session position?). Minimal future version: `optInDeclined: boolean` on `BlockExecutionState`. Phase 5 recommendation work should pick this up.
- Runtime **Skip** still just ends the session earlier — no live redistribution.

## 8. Phases

### Phase 1: Fractional minutes through the planner

- §4.1 across `allocateTime`, `splitRepertoire`, `redistributeForAvailability`, `applyMaintenanceLeftover`, `maintenanceCost`, `pickTechnique`.
- `utils/format-minutes.ts` + its wiring into the setup preview and summary rows is **already done** — verify, do not rebuild.
- Update `utils/session-planner.test.ts` to fractional expectations (`toBeCloseTo`); assert every allocation sums exactly to the requested total.

### Phase 2: Cap, packing, opt-in offer (planner)

- `MAINTENANCE_INFLATION_CAP_MINUTES`, skip-and-continue packing, `inflationMinutes`, `optIn` (§4.2–4.4), `forcedMaintenancePieceId`, `planTotalMinutes`.
- `models/session.ts`: `MaintenanceOptIn`, `SessionPlan.inflationMinutes`, `SessionPlan.maintenanceOptIn`.
- Unit tests: exact-allowance boundary; oversized best piece skipped and next-best taken; group cap with several pieces; no piece fits → empty maintenance + leftover to learning/stabilizing + opt-in offered; budget 0 → no opt-in; forced pick swaps and zeroes leftover; forced pick ineligible → ignored; deterministic order.

### Phase 3: Setup screen — total row + opt-in

- §5.1 total row with `(+N)`; §5.2 checkbox with escalation badge; §5.3 reset-on-input-change; two-pass plan memo (base plan → effective plan when ticked).
- i18n keys + a11y labels.

### Phase 4: Real total everywhere else

- §5.4 in coach, summary and the overview resume banner via `planTotalMinutes`.
- Verify sessions stored before this change (no `inflationMinutes`) still load.

### Phase 5: Lint, tests, Playwright e2e

- `yarn lint` + `yarn test` green, **including pre-existing issues**.
- Playwright (login `senth.wallace@gmail.com` / `hellomynameispassword123`, port per CLAUDE.md — 8081 main, 8082 worktree):
  - 30-min balanced with a ~5-min maintenance piece → auto-included, total row shows 33 (+3).
  - Same with a 12-min piece → not auto-included; next-best fitting piece scheduled; opt-in row offered with `+N min`.
  - Tick the opt-in → total updates live, plan rebuilds, coach runs the oversized piece as the only maintenance block.
  - Move the slider after ticking → tick clears, plan re-plans.
  - A piece unpracticed 14+ days → badge; 21+ days → stronger wording.
  - 15-min session → no maintenance row and no opt-in.
  - Summary reads "N of N min" after an inflated session; resume banner shows the inflated total.
  - Fractional display: values that round show `~N min`, exact values show `N min`.
