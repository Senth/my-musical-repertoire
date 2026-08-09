# Session coach

## 1. What

The runtime half of a practice session: the screens that take a `SessionPlan` and
walk the student through it block by block. Setup previews the plan and starts
it; the coach runs one block at a time with a session bar and a block bar,
wrapping the ordinary practice screens in a shell that replaces their Save button
with **Save & next**; the summary reports what happened. An in-flight session
survives closing the app and is resumable from Overview.

Sessions are **ephemeral** — they live in AsyncStorage and are cleared on
completion. Nothing about the session itself is written to Firestore; the
practice logs its blocks produce are.

## 2. Why

The student's stated need: *"I had 30 minutes. How should I structure it?"* The
app already had lifecycle states, sections, BPM tracking and per-item logging.
What it lacked was the structure — allocate, guide, log — and a way to keep the
student inside that structure once it starts, instead of navigating around the
app between items.

Wrapping the existing practice screens rather than building new ones is
deliberate: a block is an ordinary practice, so it must log identically and look
identical, or the coach becomes a second, divergent way to record the same thing.

## 3. Data model

**No Firestore changes.** AsyncStorage only, per-user namespaced by auth uid
(`utils/session-storage.ts`):

| Key | Value | Purpose |
| --- | --- | --- |
| `active-session:{uid}` | `ActiveSession` | In-flight session, for resume |
| `sight-reading-bpm:{uid}` | `string` | Last-used reading tempo |
| `installPromptDismissed:{uid}` | `"1"` | See [`pwa-support.md`](pwa-support.md) |

```ts
export interface BlockExecutionState {
  index: number;
  status: "pending" | "in-progress" | "completed" | "skipped";
  elapsedSeconds: number;
  extendMinutes: number;
}

export interface ActiveSession {
  plan: SessionPlan;
  startedAt: string;          // ISO
  sessionId: string;          // tags every practice log written this session
  currentBlockIndex: number;
  blockStates: BlockExecutionState[];
  sessionElapsedSeconds: number;
  currentBlockStartedAt?: string | null;
  /** Set when the user leaves the coach, cleared on resume. */
  pausedAt?: string | null;
}
```

`sessionId` is the only join key between a session and its logs — every practice
written from a block carries it, along with `triggeredFrom: "session-coach"`.

**Elapsed time is wall-clock, not tick-counted.** Both bars compute from
`startedAt` / `currentBlockStartedAt`; the 1-second interval is a re-render tick
only, so backgrounding the tab can never under-count.

## 4. Setup (`app/(app)/session/setup.tsx`)

Preview and Start — nothing else. The preset decides the minutes, so this screen
has no total slider and no include-switches; the pencil in the app bar opens the
preset editor.

```
‹  Weekday quick                    ✎

   warmup             3 min
   sight-reading      5 min
   technique          6 min
   Chopin Op.9 · A   10 min
   Bach WTC · B       6 min
   ──────────────────────────
   total             33 min  (+3)

   ☑ Practice Sonata in G instead   (+11 min)
       [14 days]

   [         Start          ]
```

- One row per emitted block, so a line producing several blocks (learning,
  stabilizing, maintenance) shows several lines. Minutes render through
  `displayMinutes` — `~4 min` when rounding moved the value, `4 min` when exact.
- `OmittedRow` entries explain any slot that was zeroed and where its minutes
  went, using the plan's `omitted[]`.
- **Total row** closes the list so the plan reads as a receipt that adds up. It
  shows `planTotalMinutes(plan)`, with a `(+N)` suffix and an accent colour only
  when `inflationMinutes > 0`.
- **Opt-in checkbox** renders only when `plan.maintenanceOptIn` is set. Ticking it
  re-plans with `forcedMaintenancePieceId` and the total updates live. Escalation
  by `daysSinceLastPracticed`: `>= 14` shows an accent day-count badge, `>= 21`
  the stronger "3 weeks — consider scheduling it" wording. Without escalation the
  long pieces the student specifically wants to keep remembered depend on being
  noticed.
- The tick is plain screen state and is never persisted — deciding fresh each
  session *is* the feature.

**Start** writes the `ActiveSession` (fresh `sessionId`, `currentBlockStartedAt`
set) and routes to the coach. For a Custom session it also writes the values back
to the scratch preset doc.

## 5. Coach (`app/(app)/session/coach.tsx`)

```
┌─────────────────────────────────────────┐
│ Session         12:34          -17:26   │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░       │
│                                          │
│ Block 3/5  Bridge (Beethoven Op.27)      │
│ ██████████████░░░░░░    4:12    -3:48   │
└─────────────────────────────────────────┘
```

`CoachShell` renders the two bars, the `[Skip]` and `[Extend +2 min]` actions and
the `[Save & next block]` CTA; `CoachContext` carries `coachMode`, the save
handler refs and `notify()` down to the block body. The session bar's denominator
is `planTotalMinutes(plan)`, so an inflated session never reads "33 of 30".

When a block timer reaches 0 the bar turns a warning colour and
`playBlockEndCue()` fires **once** per block index. There is no auto-advance;
remaining time simply goes negative.

### Block bodies

| BlockKind | Body |
| --- | --- |
| `warmup` | technique practice screen for the picked maintenance technique; freeform timer when there is none |
| `technique` | technique practice screen |
| `sight-reading` | `SightReadingBlockBody` — see §5.1 |
| `repertoire-review` / `repertoire-learning` / `repertoire-stabilizing` | piece practice screen **with** `sectionId` |
| `repertoire-maintenance` | piece practice screen **without** `sectionId` (whole piece) |

The practice screens are unchanged in standalone use. Under the shell they hide
their own Save button and expose their save handler through `CoachContext`;
`handleSaveAndNext` returns early when the save reports `saved: false`, so an
incomplete block simply will not advance. **Skip** is the escape hatch and writes
nothing.

`PlannedBlock.modeKey` preselects the hands/drill mode that made the block worth
planning, so the student lands on the hand that needs work.

### 5.1 Sight-reading block

A BPM input plus a metronome button, with the last-used tempo remembered in
`sight-reading-bpm:{uid}` (debounced write on change, prefilled on mount). The
metronome is stopped by the coach on advance through a `stopRef`.

This BPM is a **reading convenience tempo**. It is never written to Firestore and
never conflated with `piece.lastAchievedTempoBpm`. Sight-reading blocks produce
no practice log at all — the block is a timer.

### 5.2 Duration prompt

Advancing out of a `repertoire-maintenance` block whose piece has
`durationSeconds == null` opens a dialog **before** the advance:

```
Set duration for {pieceTitle}?
Measured: ~{mm:ss}        (block elapsed)
[ {minutes} ] min         (editable; prefilled round(elapsed/60), min 1)
[Skip]              [Save]
```

Save writes `durationSeconds = minutes × 60` via `updatePiece`; Skip writes
nothing. It fires only on maintenance whole-piece blocks, and never on a skipped
block — no play-through happened.

### 5.3 Phase offer

A save that raises a phase nudge parks it on `CoachContext.phaseOfferRef`; the
coach screen shows `PhaseOfferDialog` after the save commits and **before**
`advance("completed")`, because the block body unmounts on advance. Details in
[`section-phases.md`](section-phases.md).

### 5.4 Pause, resume and leaving

Leaving the coach stamps `pausedAt`. On return the **session** total continues
from where it left off while the **current block** restarts at 0:00 — the student
walked away mid-block, and pretending otherwise would report time they did not
practise.

`useWakeLock` holds the screen awake exactly while a block is running: an active
session, not paused, with a `currentBlockStartedAt`. On web the back gesture is
trapped by a `popstate` sentinel offering **Keep practicing** / **Pause & exit**
— see [`pwa-support.md`](pwa-support.md).

Notices (for example "2 sections moved back to stabilizing") are rendered by a
`Snackbar` owned by the **coach screen**, not the block body, so they survive the
advance.

## 6. Overview entry and resume

Overview's session section lists the presets with their derived totals plus the
always-present Custom row and a Manage presets entry
([`session-presets.md`](session-presets.md)). When an active session exists the
section is replaced by a resume banner:

```
🎵 Session in progress — Weekday quick, 33 min
   Block 3 of 5: Beethoven Op.27 (Bridge)
   [Resume]   [End]
```

Resume routes to the coach; End clears the active session with no summary. The
banner's minute count is `planTotalMinutes`.

## 7. Summary (`app/(app)/session/summary.tsx`)

```
Session complete

Total practiced:  28 of 33 min
Blocks done:      4 of 5  (1 skipped)

What you practiced:
  ✓ Technique     7 min — Hanon No. 1
  ✓ Sight-reading 4 min
  ✓ Review        6 min — Beethoven Op.27 / Intro
  ✓ Learning     10 min — Beethoven Op.27 / Bridge
  ⤬ Stabilizing  (skipped)

[Done]
```

Practised minutes sum the `elapsedSeconds` of **completed** blocks only. Any
qualifying add-next-section nudges render after the block list, restricted to
pieces that actually appear in this session's blocks
([`section-phases.md`](section-phases.md) §5.3). **Done** clears the active
session and returns to Overview.

## 8. Logging

| Block kind | Log |
| --- | --- |
| `warmup`, `technique` | technique log via `useSaveTechniqueLog` |
| `repertoire-review` / `-learning` / `-stabilizing` | section practice via `useSaveSectionPractice`, `sectionId` set |
| `repertoire-maintenance` | whole-piece practice via `useSavePractice`, no `sectionId` |
| `sight-reading` | **none** |
| skipped blocks | **none** — tracked in `blockStates` only |

Every write carries `triggeredFrom: "session-coach"` and the session's
`sessionId`. The shapes themselves belong to
[`practice-logging.md`](practice-logging.md).

**Known gap:** nothing persists planned-vs-actual minutes per category.
`ActiveSession` is cleared on completion and sight-reading writes nothing, so
session-shape analysis has no data source yet.

## 9. Out of scope

- **Persisting sessions or summaries to Firestore.**
- **Sight-reading material model or logging.**
- **Per-block "why was this chosen" rationale** — `PlannedBlock.rationale` exists
  and is unused; that is
  [#17](https://github.com/Senth/my-musical-repertoire/issues/17).
- **Live redistribution on Skip** — skipping ends the session earlier.
- **Breaks in long sessions.**
- **Per-piece sight-reading BPM** — sight-reading blocks have no `pieceId`.
- **Simultaneous sessions across devices** — last-write-wins, no conflict UI.
- **An in-app reload / "reset app" control** — a mid-practice mis-tap risk for a
  failure mode with no evidence behind it.
