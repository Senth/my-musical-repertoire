# Session presets

Tracking issue: [#74](https://github.com/Senth/my-musical-repertoire/issues/74)

## 1. What

A session preset is a user-owned, editable, named list of **minutes per block
kind**. Presets replace the four hardcoded emphases the app shipped with: the
student picks a preset on Overview, the planner resolves it into a
`SessionAllocation`, and that is the whole of "how long is this session and what
shape does it have". An unsaved **Custom** entry covers one-off sessions and
remembers whatever was last run in it.

Total is **derived** — the sum of the enabled lines. There is no total slider and
no scaling anywhere.

## 2. Why

The four fixed emphases plus a total slider gave the student one sentence of
vocabulary ("Balanced, 30 min") and hid two thirds of the result: the old
`splitRepertoire()` silently carved repertoire into learning / stabilizing /
maintenance at 0.55 / 0.30 / 0.15, so "repertoire 16 min" became 8.8 / 4.8 / 2.4
— and 2.4 minutes is not a run-through of anything. The student configured a
third of the session and could not see the rest.

Presets also match how practice is actually assigned. A teacher says "5 minutes
of scales, 15 on the Bach", not "18% technique". A student with a weekday shape
and a weekend shape saves two presets.

### The pedagogy behind the numbers

- **Absolute minutes, never percentages.** Fixed costs (warmup, one technique
  item done properly) barely shrink with total time; what scales is breadth and
  depth, not minutes-per-item. Proportional scaling produces 19-minute technique
  bloat at 75 min and 1.3-minute theatre at 20.
- **Never generate slivers.** One 12-minute block beats three 4-minute blocks.
  Enforced by per-line floors in the editor, so slivers are impossible by
  construction rather than dropped at runtime.
- **Warmup matters more in short sessions, not less.** The old `>= 60 min` gate
  was backwards: a 20-minute session means cold hands straight into hard work.
- **Reading is never last.** Tired reading is guessing, and guessing is the
  reflex it trains.
- **Repertoire content stays engine-chosen.** Pinning specific pieces to a preset
  would defeat the scoring engine and enable the classic failure of practising
  what already sounds good.

## 3. Data model

### `users/{userId}/sessionPresets/{presetId}`

| Field | Type | Notes |
| --- | --- | --- |
| `name` | `string` | User-facing. Seeded built-ins get localized default names. |
| `order` | `number` | Sort order on Overview. |
| `lines` | `PresetLines` | Minutes per block kind. Absent key or `null` = line disabled. |
| `scratch` | `boolean` | `true` for the single remembered **Custom** doc (id `custom`). Excluded from the preset list. |
| `createdAt` / `updatedAt` | `Timestamp` | |

`models/session-preset.ts` owns the types, the limits, and the seeds:

```ts
export type PresetLineKey =
  | "warmup" | "sightReading" | "technique"
  | "repertoireLearning" | "repertoireStabilizing" | "repertoireMaintenance";

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

`allocationFromLines(lines)` resolves a preset into the `SessionAllocation` the
planner consumes; `presetTotalMinutes(lines)` derives the displayed total.

### Line floors and ranges (`PRESET_LINE_LIMITS`)

Zero is not typeable. Each line is a **checkbox plus a slider**; unchecking is
how a category is switched off, and the slider's minimum *is* the floor.

| Line | Floor | Max | Step | Why the floor |
| --- | --- | --- | --- | --- |
| `warmup` | 3 | 15 | 1 | Below 3 the hands are not warm. |
| `sightReading` | 5 | 30 | 1 | Needs 2–3 short items; 3 min is one panicked run. |
| `technique` | 5 | 45 | 1 | One item: slow → correct → repeat. |
| `repertoireLearning` | 8 | 60 | 1 | Full loop: slow, hands separate, correct, tempo step. |
| `repertoireStabilizing` | 5 | 45 | 1 | |
| `repertoireMaintenance` | 3 | 60 | 1 | Maintenance is quantized to whole run-throughs by the planner, so the floor is "one short piece" rather than a fixed working span. |

The teacher review proposed 6 for stabilizing and 5 for maintenance. Both were
lowered so that every seeded preset is reproducible by hand — a default the
editor refuses to re-create is incoherent.

A different total means a different preset. If setting a total directly is ever
wanted, it returns as a *generator* — pick a total, get a suggested distribution,
save it as a preset — never as a live scaling knob on an existing preset.

### Seeded defaults (`DEFAULT_PRESET_SEEDS`)

On first load, if the user has no non-scratch presets, four are written in one
batch. All seed at **30 minutes** — the totals differ only in shape, which is
what "emphasis" ever meant.

| Preset | warmup | reading | technique | learning | stabilizing | maintenance | total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Balanced | — | 5 | 6 | 11 | 5 | 3 | 30 |
| Reading focused | — | 9 | 5 | 10 | 6 | — | 30 |
| Technique focused | 3 | — | 13 | 8 | 6 | — | 30 |
| Repertoire focused | 3 | — | — | 12 | 8 | 7 | 30 |

Three rules shaped these:

- **Reading never seeds below its 5-minute floor.** Where the old reference row
  had a 2-minute reading sliver (technique- and repertoire-focused) the line is
  switched off outright rather than inflated — a preset named for technique is
  allowed to contain no reading.
- **A preset that opens on reading needs no separate warmup line.** Reading is
  heavy on the brain and light on the hands, so it *is* the warmup. Presets that
  open on technique or repertoire meet cold hands and seed 3 minutes.
- **Balanced earns its name by touching every category.** It is the only seed
  carrying reading, technique, learning, stabilizing and maintenance, so a
  student who only ever runs Balanced still keeps old repertoire from rotting.

Deleting a built-in is permitted. **Restore default presets**
(`missingDefaultSeeds`) re-adds any missing built-in **by localized name**
without touching existing presets.

### `firestore.rules`

```
match /users/{userId}/sessionPresets/{presetId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

**Must be deployed with `yarn deploy:dev`** — a rule that only exists in the file
produces "Missing or insufficient permissions" on the first write.

### Legacy plans

`SessionPlan` carries `presetId` and `presetName`. Plans persisted in
AsyncStorage before presets existed carry an `emphasis` string and no name;
`planPresetName(plan, fallback)` falls back to a generic label rather than
discarding the session — someone mid-session during an update should not lose it.

## 4. Block order

One canonical order for every preset (`CANONICAL_BLOCK_ORDER`):

```
warmup → sight-reading → technique → review → learning → stabilizing → maintenance
```

Reading sits directly after warmup: it is demanding on the brain but light on the
hands, so it extends the warmup rather than competing with technique, and reading
last only trains guessing. Disabled lines simply vanish from the sequence.
Per-preset ordering is not stored; if it is ever wanted it can be added as a
`PresetLineKey[]` field without a migration.

(`repertoire-review` is emitted by the learning line, not by a preset line — see
[`session-planner.md`](session-planner.md).)

## 5. UI

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

Each row shows its derived total. Tapping starts the flow; the row's overflow
offers Edit, Duplicate, Delete.

### Preset editor (`app/(app)/session/preset-editor.tsx`)

Six checkbox + slider rows in canonical order, a live derived total, and a name
field.

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

Each ⓘ expands (tap on mobile, hover or tap on web) into a one-line explanation
of what that category is — in particular what separates learning from
stabilizing from maintenance, which is the vocabulary the flat model asks the
student to use. Content is not part of the ⓘ text; it explains the category, not
the engine's choice.

The **Custom** row opens the same editor prefilled from the scratch doc, with
`[ Start ]` and `[ Save as preset ]`. Starting writes the values back to the
scratch doc so Custom remembers.

### Manage presets (`app/(app)/session/manage-presets.tsx`)

Reorder (updates `order`), rename, duplicate, delete, and **Restore default
presets**. Deleting every preset is allowed — the Custom row is always available,
so there is no empty dead end.

## 6. Offline / sync

Presets are ordinary Firestore documents, so the existing offline persistence
covers them: edits made offline queue and sync, and the list reads from cache.
Two consequences are handled explicitly:

- **Seeding must not double-fire.** Seed only after the presets query has
  resolved from cache or server, and write the four docs in one batch.
- **First-ever load may be empty offline** for a brand-new account that has never
  synced. The Custom row still works, so the screen is never dead.

## 7. Logging

No new logging. Practice logs keep their existing `sessionId` tagging, and
`presetId` / `presetName` ride on `SessionPlan` into the persisted
`ActiveSession`, so once session summaries are written the preset identity is
already on the plan.

**Known gap, deliberately deferred:** nothing persists actual minutes per
category. `ActiveSession` is AsyncStorage-only and cleared on completion,
category minutes are reconstructible only by joining practice logs on
`sessionId`, and **sight-reading writes nothing to Firestore at all**. Until that
changes, coverage nudges ("no sight-reading in 14 days"), shrink auto-tuning and
preset self-correction have no data source.

## 8. Out of scope

- **Session summary persistence** — planned vs actual minutes per category.
- **Sight-reading logging to Firestore** — prerequisite for reading coverage.
- **Coverage nudges** — "no sight-reading in 3 weeks", shrink auto-tuning,
  preset self-correction.
- **Pinning technique sets to a preset.** Technique prioritization already works
  globally through the state in the scoring engine; per-preset pinning would mean
  maintaining the same list in every preset.
- **Per-preset block order** — canonical order only.
- **"Set a total, get a distribution" generator.**
- **Breaks in long sessions** — a 75-minute unbroken session is two sessions
  pretending to be one.
- **Memory as its own `BlockKind`** — currently smuggled inside repertoire, so it
  never gets scheduled. Required at upper RCM levels.
- **Exam / performance mode** — changes what happens *inside* repertoire
  (continuity, no stopping, memory under pressure), not the minute split, so it
  cannot be expressed as a preset.
- **Weekly templates** — "technique 4×, reading 3×, run-throughs Sunday". The
  schema is deliberately free of session-only assumptions so a preset can later
  bind to weekdays.
- **Lesson / performance date on `Piece`** — a scoring boost, the better answer
  to "I must practise X today" than pinning.
- **Repertoire pinning** — rejected on pedagogical grounds, not deferred.
