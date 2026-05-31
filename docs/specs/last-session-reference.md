# Phase 0: Handoff

**Spec file:** `docs/specs/last-session-reference.md` (this file).

**Implementer instructions:**

- Use the **Phases** section below as your implementation plan. No separate PLAN.md planning needed.
- Work the phases in order; each is sized for one focused session.
- After all phases are verified working (tests + lint green, Playwright pass on individual screens **and** inside the session coach), check off the PLAN.md item:
  `- [ ] When practicing anything, it would be good to see the last log for that piece/section/technique to have a reference point...` (Phase 3, Misc, ~line 212).
- A deferred follow-up ("note for next time" per-log field) has already been added to PLAN.md — do **not** implement it here; it is explicitly out of scope.
- Caveman responses for any user-facing replies.

---

# Last-Session Reference Card

## 1. What

At the moment of logging a practice (piece, section, or technique — including inside the session coach), show a compact, read-only **"Last session — for reference"** card populated from that exact item's most recent practice log, so the student has an anchor before they play and log.

## 2. Why

A teacher's most useful note is "where we were last time." The app already captures rich per-log data but only surfaces it **after** saving (the post-save comparison). Showing the previous log **before/during** logging gives the student context to calibrate expectations (tempo reached, how clean, how long ago) without guessing. It also feeds nothing new to the DB — pure surfacing of existing signal — so it is low-risk and correctly sequenced before the session-plan generator and recommendation phases (in fact it makes their value visible).

Pedagogy guidance baked in (from piano-teacher review):

- **Field priority:** tempo (achieved BPM vs target) → quality signal → date → effort (last/optional).
- **Type-specific emphasis:** section → phase + currentBPM vs target; piece → mistake density primary; technique → BPM vs target prominent.
- **Anchoring guardrails:** label it "for reference," **neutral styling, no red/green regression coloring, no up/down arrows** (verdict stays in the post-save comparison). If the last log is >10 days old, frame it "after a break."
- **Single last log only** (no trend) for this release.

## 3. Data model

**No schema changes.** Reads existing `practiceLogs` subcollections.

Source of truth is the **actual latest log document**, not the cached `last*` fields on the parent doc. Reason (teacher hard-stop): cached `lastQuality`/`lastEffort` (section) and `lastTechnicalMistakes`/`lastMemoryMistakes` (piece) can lag the cached `lastPracticed` date in edge cases (e.g. a section flagged during a full-piece practice updates `lastPracticed` but not quality/effort). Reading the latest log keeps date + metrics coherent.

**Piece scope = full-piece logs only.** Full-piece practices write to `pieces/{id}/practiceLogs`; section-only practices write to `sections/{sid}/practiceLogs`. The full-piece card reads only the former, so "last session" on the full-piece screen means "last time I ran the whole piece" (coherent technical/memory-mistake fields). Section-only work never alters the full-piece card; it surfaces on each section's own screen.

**Firestore rules already permit reads** on all three `practiceLogs` subcollections (verified) — no rules change/deploy needed.

New hook **`useLastPracticeLog`** (in `hooks/`), one-shot read (`getDocs`, not realtime) at mount, `orderBy("date", "desc")`, `limit(1)`. Single-field `date` index — no composite index needed.

Scopes and returned fields:

| Scope | Collection path | Fields read |
| --- | --- | --- |
| piece (full) | `users/{uid}/pieces/{pieceId}/practiceLogs` | `date`, `technicalMistakes`, `memoryMistakes`, `achievedBpm` |
| section | `users/{uid}/pieces/{pieceId}/sections/{sectionId}/practiceLogs` | `date`, `quality`, `effort`, `achievedBpm` |
| technique | `users/{uid}/techniques/{techniqueId}/practiceLogs` | `date`, `quality`, `effort`, `achievedBpm` |

Hook returns `{ lastLog: NormalizedLastLog | null, loading: boolean }` where `NormalizedLastLog` carries `date: Date` plus the optional metrics. `null` = no prior log (first practice).

Read happens at mount → reflects state **before** the log the student is about to create (correct "previous").

## 4. UI flow

New component **`components/practice/LastSessionCard.tsx`** — read-only, neutral (`surfaceVariant` container, `onSurfaceVariant` text, `labelLarge` header). No buttons, arrows, or status colors.

**Placement:** top of the practice content column, directly under the identity/title block and above the BPM input — same spot in all three screens, so it appears identically inside the session coach (which reuses `PiecePracticeContent` / `TechniquePracticeContent`).

**Header:** `Last session · {when}` where `{when}` = `formatDaysAgo(lastLog.date)`. If gap > 10 days, append the "after a break" framing.

**Body (type-aware, in priority order):**

- **Tempo (all):** `{achievedBpm} BPM` + `(target {n})` when a target exists (section: `targetBpmOverride ?? piece.targetTempoBpm`; technique: `targetTempoBpm`; piece: `piece.targetTempoBpm`). Show `—` if no BPM was logged.
- **Section / technique:** `Quality: {label}` then `Effort: {label}` (both shown; effort de-emphasized) — reuse existing `technique.quality.{1-5}` / `technique.effort.{1-5}` strings.
- **Piece (full):** `Technical: {level}` and `Memory: {level}` — reuse existing `screen.practice.mistakeLevel.*` strings.

**Section phase context:** on the **scoped-section** practice screen, also render the section's `SectionPhaseChip` next to the section label in the identity block (separate from the card). The full-piece screen already shows phase per row in `SectionsPracticePanel`; this closes the gap so the student frames tempo expectations correctly (low BPM is expected in `learning`). The `>10 days → after a break` threshold is a named constant (default 10).

**Empty / first practice:** when `lastLog` is `null`, render a muted single line ("First practice — no reference yet" / reuse `comparison.firstPractice` tone) instead of the card. While `loading`, render nothing (or a slim placeholder) — do not flash.

**Identity-line cleanup:** the piece screen's existing plain `Last practiced: {when}` `bodySmall` line is now redundant with the card header — remove it (card subsumes it). Technique screen currently shows no last-practiced line; the card adds it.

**Post-save comparison consolidation (confirmed — single source):** feed the fetched `lastLog` into the existing `previous*` props of `PracticeComparison` / `TechniqueLogComparison`, replacing the cached-field seeding (`previousDataRef`, `previousSectionDataRef`, `seededRef`, `seededSectionRef`). The mount-time fetch is the correct "previous" for the comparison too, and removes the duplicate read path. **Intentional semantic change:** the section comparison's "previous tempo" shifts from the section's working BPM (`currentBpm`) to the last *achieved* BPM from the log — this is the desired behavior (compare achieved vs achieved). Update `TechniqueLogComparison`/section comparison call sites accordingly and adjust their tests.

**BPM prefill unchanged:** input still prefills from section `currentBpm` / `lastAchievedTempoBpm` as today (intentionally the student-set working BPM, distinct from last achieved). The card is informational only.

## 5. Logging

Read-only feature — **produces no new logged signals** (the "note for next time" capture that would feed recommendations is deferred; see Out of scope). No writes added.

## 6. Out of scope

- **Per-log "note for next time" free-text field** — deferred to a follow-up (added to PLAN.md). The card shows existing metrics only.
- Multi-log **trend / sparkline** — single last log only.
- **Regression verdict / coloring / arrows** in the reference — stays neutral; verdict remains in the post-save comparison.
- Changing **BPM prefill** logic.
- **Sight-reading** reference — sight-reading blocks use the freeform coach body and have no per-item log.
- Realtime updates of the card — one-shot read at mount is sufficient.
- **Per-section-row last log** inside `SectionsPracticePanel` — the panel rows stay as-is (label + phase + current/target BPM + notes). The reference card only appears on the item the student is actively logging.
- The card on **detail screens** — only the practice/logging screens (+ coach) get the card.

## 7. Phases

### Phase 1 — Data hook

- Add `hooks/use-last-practice-log.ts` exposing `useLastPracticeLog` with the three scopes (piece / section / technique), one-shot `getDocs` + `orderBy("date","desc")` + `limit(1)`, returning normalized `{ lastLog, loading }`.
- Normalize Firestore `Timestamp` → `Date`; map missing metrics to `null`.
- Add a focused test (mirror `hooks/use-pieces.test.ts` style) covering: returns latest of multiple logs, returns `null` when none, normalizes fields per scope.

### Phase 2 — Card component + screen wiring + i18n

- Add `components/practice/LastSessionCard.tsx` (type-aware, neutral styling, >10-day "after a break", `—` for missing BPM, first-practice empty line, loading no-flash).
- Add i18n keys under `screen.practice` / `screen.practiceTechnique` (e.g. `lastSession.header`, `lastSession.afterBreak`, `lastSession.tempo`, `lastSession.quality`, `lastSession.effort`, `lastSession.technical`, `lastSession.memory`, `lastSession.firstPractice`). Reuse existing quality/effort/mistakeLevel strings for values.
- Wire into `PiecePracticeContent` (full-piece scope **and** scoped-section scope) and `TechniquePracticeContent`. Remove the redundant piece identity `Last practiced` line.
- Add the `SectionPhaseChip` to the scoped-section identity block on `PiecePracticeContent`.
- Consolidate `PracticeComparison` / `TechniqueLogComparison` `previous*` props to use the fetched `lastLog`; remove the now-unused cached-field seeding refs (`previousDataRef`, `previousSectionDataRef`, `seededRef`, `seededSectionRef`) and update affected comparison tests (incl. the section previous-tempo semantic change).

### Phase 3 — End-to-end verification + cleanup

- Playwright (worktree → `http://localhost:8082`, else `8081`; login with test creds from CLAUDE.md):
  - Individual piece practice (full), section practice, technique practice — card shows correct previous log; first-practice item shows the empty line.
  - Inside an active **session coach** block — card renders identically for piece/section/technique blocks.
  - Verify neutral styling (no red/green, no arrows) and "after a break" framing on an item with an old log.
- Run **all** tests + lint (`yarn` scripts); fix every issue including pre-existing.
- Confirm the deferred "note for next time" item exists in PLAN.md; check off the feature item (Phase 3 Misc, ~line 212).
