# Custom Session Presets

> Issue: [#74](https://github.com/Senth/my-musical-repertoire/issues/74)

# Phase 0: Handoff

You are implementing this spec: **`docs/specs/custom-session-presets.md`** (this file).

- The **Phases** section at the bottom is your implementation plan. Work them in order, one phase
  per session. Each phase must leave the app in a working state.
- Every decision here was settled in a design session with the project owner and a pedagogy
  review. Do not re-litigate them — in particular: absolute minutes (never percentages), flat
  six-line model with `splitRepertoire()` deleted, checkbox-plus-slider with the floor as the
  slider minimum, one canonical block order, and engine-chosen repertoire content.
- If you hit something the spec genuinely does not cover, ask rather than inventing a rule.
- Tracking issue: **#74**. It is on the board in *In Progress* and carries these phases as a task
  list — tick each one as it lands.
- **Phase 1 changes `firestore.rules`.** Deploy with `yarn deploy:web` or every preset write fails
  with "Missing or insufficient permissions".
- After every phase: run the full test suite and lint, and fix pre-existing failures too. Verify
  visual and interactive changes in the running web app with the playwright skill (main:
  http://localhost:8081, worktree: http://localhost:8082).
- When all phases are verified, close #74 from the PR body with `Closes #74` and run
  `scripts/sync-todo.sh`.

## What

Replace the four hardcoded session emphases with user-owned, editable **session presets** — a
named list of per-block-kind minutes — plus an unsaved **Custom** entry for one-off sessions.

## Why

Today the student picks one of four fixed emphases and a total, and the planner interpolates a
hardcoded reference table into minutes. Two problems:

1. **No real control.** "Balanced, 30 min" is the whole vocabulary. A student who knows they want
   12 minutes of technique today cannot say so.
2. **Two thirds of the session is invisible.** `splitRepertoire()` silently carves repertoire into
   learning / stabilizing / maintenance at 0.55 / 0.30 / 0.15. Setting "repertoire 16 min" produces
   8.8 / 4.8 / 2.4 — and 2.4 minutes is not a run-through of anything. The student configures a
   third of their session and cannot see the rest.

Presets also match how practice is actually assigned. A teacher says "5 minutes of scales, 15 on
the Bach", not "18% technique". Concrete saved numbers are easier to grasp than a scaling
template, and a student with a weekday shape and a weekend shape simply saves two presets.

### Pedagogical constraints (from teacher review)

- **Absolute minutes, never percentages.** Fixed costs (warmup, one technique item done properly)
  barely shrink with total time; what scales is breadth and depth, not minutes-per-item.
  Proportional scaling gives 19-minute technique bloat at 75 min and 1.3-minute theater at 20.
- **Never generate slivers.** One 12-minute block beats three 4-minute blocks. Enforced here by
  per-line floors in the editor, so slivers are impossible by construction rather than dropped at
  runtime.
- **Warmup matters more in short sessions, not less.** The current `>= 60` gate is backwards: a
  20-minute session means cold hands straight into hard work.
- **Reading is never last.** Tired reading is guessing, and guessing is the reflex it trains.
- **Repertoire content stays engine-chosen.** Pinning specific pieces to a preset would defeat the
  scoring engine and enable the classic failure of practicing what already sounds good.

## Data model

### New Firestore collection

`users/{userId}/sessionPresets/{presetId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | User-facing. Seeded built-ins get localized default names. |
| `order` | `number` | Sort order on Overview. |
| `lines` | `PresetLines` | Minutes per block kind. Absent key or `null` = line disabled. |
| `scratch` | `boolean` | `true` for the single remembered **Custom** doc. Excluded from the preset list. |
| `createdAt` / `updatedAt` | `Timestamp` | |

```ts
// models/session-preset.ts
export type PresetLineKey =
  | "warmup"
  | "sightReading"
  | "technique"
  | "repertoireLearning"
  | "repertoireStabilizing"
  | "repertoireMaintenance";

/** Minutes per line. `null`/absent = the line is switched off for this preset. */
export type PresetLines = Partial<Record<PresetLineKey, number | null>>;

export interface SessionPreset {
  id?: string;
  userId: string;
  name: string;
  order: number;
  lines: PresetLines;
  scratch?: boolean;
}
```

`firestore.rules` gains one match block, mirroring the existing per-user pattern:

```
match /users/{userId}/sessionPresets/{presetId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**Must be deployed with `yarn deploy:web`** — a rule that only exists in the file produces
"Missing or insufficient permissions" on first write.

### Line floors and ranges

Zero is not typeable. Each line is a **checkbox plus a slider**; unchecking is how a category is
switched off, and the slider's minimum *is* the floor.

| Line | Floor | Max | Step | Why the floor |
| --- | --- | --- | --- | --- |
| `warmup` | 3 | 15 | 1 | Below 3 the hands are not warm. |
| `sightReading` | 5 | 30 | 1 | Needs 2–3 short items; 3 min is one panicked run. |
| `technique` | 5 | 45 | 1 | One item: slow → correct → repeat. |
| `repertoireLearning` | 8 | 60 | 1 | Full loop: slow, hands separate, correct, tempo step. |
| `repertoireStabilizing` | 5 | 45 | 1 | |
| `repertoireMaintenance` | 3 | 60 | 1 | Maintenance is quantized to whole run-throughs by the existing planner, so the floor is "one short piece" rather than a fixed working span. |

The teacher review proposed 6 for stabilizing and 5 for maintenance. Both were lowered so that
every seeded preset is reproducible by hand — a default the editor refuses to re-create is
incoherent, and 3 minutes of maintenance is a legitimate unit given whole-piece quantization.

Total is **derived** — the sum of enabled lines. There is no total slider and no scaling. A
different total means a different preset. If setting a total directly is wanted later, it returns
as a *generator* — pick a total, get a suggested distribution, save it as a preset — never as a
live scaling knob on an existing preset.

### Seeded defaults

On first load, if the user has no non-scratch presets, four are written. All seed at **30 minutes**
— a sane default session, and the totals differ only in shape, which is what "emphasis" ever meant.
Values derive from the existing 30-minute `REF_ROWS` rows, pushed through `splitRepertoire`'s old
ratios and then lifted to respect the new floors:

| Preset | warmup | reading | technique | learning | stabilizing | maintenance | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Balanced | — | 5 | 6 | 11 | 5 | 3 | 30 |
| Reading focused | — | 9 | 5 | 10 | 6 | — | 30 |
| Technique focused | 3 | — | 13 | 8 | 6 | — | 30 |
| Repertoire focused | 3 | — | — | 12 | 8 | 7 | 30 |

Two rules shaped these beyond the old numbers:

- **Reading never seeds below its 5-minute floor.** Balanced holds reading at 5 and the other lines
  give way to pay for it. Where the old row had a 2-minute reading sliver (technique- and
  repertoire-focused) the line is switched off outright rather than inflated — a preset named for
  technique is allowed to contain no reading.
- **A preset that opens on reading needs no separate warmup line.** Reading is heavy on the brain
  and light on the hands, so it *is* the warmup. Presets that open on technique or repertoire meet
  cold hands and seed a 3-minute warmup.
- **Balanced earns its name by touching every category.** It is the only seed carrying all four of
  reading, technique, learning, stabilizing, and maintenance, so a student who only ever runs
  Balanced still keeps old repertoire from rotting.

Deleting a built-in is permitted. **Restore default presets** re-adds any missing built-in by name
without touching existing presets.

### Retired code

`SessionEmphasis`, `SESSION_EMPHASES`, `FOCUS_BY_EMPHASIS`, `SessionFocusCategory`, `REF_ROWS`,
`interpolateRow`, `splitRepertoire`, `ORDER_BY_EMPHASIS`, `AllocationResult`, `allocateTime`, and
the per-emphasis AsyncStorage `SessionInputs` all go away. `buildPlan` takes a resolved allocation
instead of an emphasis string.

```ts
// The planner no longer decides how much; only what.
export interface SessionAllocation {
  warmup: number;
  sightReading: number;
  technique: number;
  repertoireLearning: number;
  repertoireStabilizing: number;
  repertoireMaintenance: number;
}

buildPlan(allocation: SessionAllocation, pieces, sections, techniques, now?, options?)
```

`SessionPlan.emphasis` is replaced by `presetId?: string | null` and `presetName: string`. Leftover
redistribution (`OmittedSlot`), the maintenance inflation cap, and the oversized-piece opt-in all
keep working unchanged — they operate on the allocation, not on the emphasis.

**Legacy `ActiveSession`.** Plans persisted in AsyncStorage carry `emphasis` and no `presetName`.
On read, fall back to a generic label rather than discarding the session — someone mid-session
during an update should not lose it.

## Block order

One canonical order for every preset:

```
warmup → sight-reading → technique → learning → stabilizing → maintenance
```

Reading sits directly after warmup: reading is demanding on the brain but light on the hands, so
it extends the warmup rather than competing with technique. It is also the placement the teacher
review insisted on — reading last trains guessing. Disabled lines simply vanish from the sequence.
Per-preset ordering is not stored; if it is ever wanted it can be added as a `PresetLineKey[]`
field without a migration.

## UI flow

### Overview — session entry

```
New Practice Session
  ▸ Balanced             30 min
  ▸ Technique focused    31 min
  ▸ Weekday quick        20 min
  ─────────────────────────────
  ⚙ Custom…              18 min   ← last used, always present
  ⋮ Manage presets
```

Each row shows its derived total. Tapping starts the flow; the row's overflow offers Edit,
Duplicate, Delete.

### Session setup — preview and Start only

The existing `app/(app)/session/setup.tsx` loses its total slider and its three include-switches.
It resolves the preset into an allocation, shows the plan, and starts. One tap from Overview to a
plan; the pencil in the app bar opens the editor.

```
‹  Weekday quick                    ✎

   warmup             3 min
   sight-reading      5 min
   technique          6 min
   Chopin Op.9 · A   10 min
   Bach WTC · B       6 min
   ──────────────────────────
   total             30 min

   ☑ also fit Rachmaninoff (+8 min)

   [         Start          ]
```

### Preset editor

Six checkbox + slider rows in canonical order, a live derived total, and a name field.

```
‹  Edit preset

   Name  [ Weekday quick            ]

   ☑ Warmup            ──●─────    3 min  ⓘ
   ☑ Sight-reading     ───●────    5 min  ⓘ
   ☑ Technique         ───●────    6 min  ⓘ
   ☑ Learning          ────●───   10 min  ⓘ
   ☑ Stabilizing       ──●─────    6 min  ⓘ
   ☐ Maintenance       ────────      —    ⓘ
   ──────────────────────────────────────
   Total                          30 min

   [ Save ]        [ Save as new ]
```

Each ⓘ expands (tap on mobile, hover or tap on web) into a one-line explanation of what that
category is — in particular what separates learning from stabilizing from maintenance, which is
the vocabulary the flat model now asks the student to use. Content is not part of the ⓘ text; it
explains the category, not the engine's choice.

The **Custom** row opens the same editor prefilled from the scratch doc, with `[ Start ]` and
`[ Save as preset ]`. Starting writes the values back to the scratch doc so Custom remembers.

### Manage presets

Reorder (updates `order`), rename, duplicate, delete, and **Restore default presets**. Deleting
every preset is allowed — the Custom row is always available, so there is no empty dead end.

## Logging

No new logging in this feature. Practice logs keep their existing `sessionId` tagging.

`SessionPlan` gains `presetId` and `presetName`, which flow into the persisted `ActiveSession`, so
once session summaries do get written the preset identity is already on the plan.

**Known gap, deliberately deferred:** nothing persists actual minutes per category. `ActiveSession`
is AsyncStorage-only and cleared on completion, category minutes are reconstructible only by
joining `practiceLogs` on `sessionId`, and **sight-reading writes nothing to Firestore at all**
(`SightReadingBlockBody.tsx` stores only a BPM to AsyncStorage). Until that changes, coverage
nudges ("no sight-reading in 14 days"), shrink auto-tuning, and preset self-correction have no
data source. Separate issue.

## Offline / sync

Presets are ordinary Firestore documents, so the existing offline persistence covers them: edits
made offline queue and sync, and the preset list reads from cache. Two consequences worth handling:

- **Seeding must not double-fire.** Seed only after the presets query has resolved from cache or
  server, and write the four docs in one batch.
- **First-ever load may be empty offline** for a brand-new account that has never synced. The
  Custom row still works, so the screen is never dead.

## Out of scope

Each becomes its own issue.

- **Session summary persistence** — planned vs actual minutes per category at completion.
- **Sight-reading logging to Firestore** — prerequisite for any reading coverage tracking.
- **Coverage nudges** — "no sight-reading in 3 weeks", shrink auto-tuning, preset self-correction.
- **Pinning technique sets to a preset** — technique prioritization already works globally through
  the learning state in the scoring engine; per-preset pinning would mean maintaining the same list
  in every preset.
- **Per-preset block order** — canonical order for now.
- **"Set a total, get a distribution" generator** — a way back to picking a total time, which then
  saves as a preset rather than scaling one.
- **Breaks in long sessions** — a 75-minute unbroken session is two sessions pretending to be one.
- **Memory as its own `BlockKind`** — currently smuggled inside repertoire, so it never gets
  scheduled. Required at upper RCM levels.
- **Exam / performance mode** — changes what happens *inside* repertoire (continuity, no stopping,
  memory under pressure), not the minute split, so it cannot be expressed as a preset.
- **Weekly templates** — "technique 4×, reading 3×, run-throughs Sunday". The preset schema is
  deliberately free of session-only assumptions so a preset can later bind to weekdays.
- **Lesson / performance date on `Piece`** — a scoring boost, the better answer to "I must practice
  X today" than pinning.
- **Repertoire pinning** — rejected on pedagogical grounds, not deferred.

## Phases

Each phase is one sub-agent session and leaves the app working.

### Phase 1 — Preset model, Firestore, seeding

`models/session-preset.ts` with `PresetLineKey`, `PresetLines`, `SessionPreset`, floor/max
constants, and a `presetTotalMinutes()` helper. `hooks/use-session-presets.ts` for CRUD following
the `use-techniques.ts` pattern, including scratch-doc read/write and `seedDefaultPresets()` /
`restoreDefaultPresets()`. Add the `sessionPresets` rules block **and deploy it with
`yarn deploy:web`**. Unit tests for seeding idempotence, total derivation, and floor constants.
No UI yet.

### Phase 2 — Planner refactor

`buildPlan` takes `SessionAllocation`. Delete `REF_ROWS`, `interpolateRow`, `splitRepertoire`,
`ORDER_BY_EMPHASIS`, `allocateTime`, `AllocationResult`, `SessionEmphasis`, `SESSION_EMPHASES`,
`FOCUS_BY_EMPHASIS`, `SessionFocusCategory`, and the per-emphasis `SessionInputs` storage. Add
`presetId` / `presetName` to `SessionPlan`, with a legacy fallback label for stored plans carrying
`emphasis`. Fix the canonical block order. Rewrite `session-planner.test.ts` and
`session-storage.test.ts` against allocations. Roughly 71 references across 8 files. App may be
temporarily wired to a hardcoded allocation at the end of this phase.

### Phase 3 — Preset editor screen

New route with the six checkbox + slider rows, name field, derived total, ⓘ expanders, and
Save / Save as new. Drives both preset editing and the Custom flow. All strings into
`i18n/locales/en-US.json`; remove the dead `screen.session.emphasis.*` and setup toggle keys.

### Phase 4 — Overview list, Custom row, manage screen

Replace `SessionEntryBlock`'s hardcoded `SESSION_EMPHASES.map` with the preset list plus totals,
the always-present Custom row, and per-row overflow. Manage screen with reorder, rename, duplicate,
delete, and Restore default presets. Rewrite `setup.tsx` as preview + Start.

### Phase 5 — MD3 padding and margin pass

Spacing tokens and consistent card padding across Overview session cards, setup, editor, and manage
screens. Kept last and self-contained so a styling sweep never hides a behaviour regression — this
phase should be its own commit even though it ships in this feature.

### Phase 6 — End-to-end verification

Full `yarn test` and lint, fixing any pre-existing failures. Then Playwright against
http://localhost:8081 (worktree: 8082), signed in as the test account:

1. Fresh account seeds four presets; totals shown on Overview match the table above.
2. Create a preset, uncheck a line, verify the slider cannot go below its floor.
3. Start a session from a preset — block order and minutes match; blocks below a floor never appear.
4. Custom row remembers its values after Start and a reload.
5. Delete a built-in, Restore default presets re-adds exactly that one.
6. Preset written offline syncs on reconnect.
7. A session already in progress from before the update still resumes.
