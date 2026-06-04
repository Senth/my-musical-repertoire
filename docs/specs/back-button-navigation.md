# Phase 0: Handoff

**Implementer:** this spec is your plan. Build it phase-by-phase using the
**Phases** section below; each phase is sized for one focused session.

- Spec file: `docs/specs/back-button-navigation.md` (this file).
- Tracking issue: [#28](https://github.com/Senth/my-musical-repertoire/issues/28)
  (labeled `bug`, board column **In Progress**). The phase checklist lives in the
  issue body — tick items as you complete them.
- After all phases verify working, close #28 via `Closes #28` in the PR body and run
  `scripts/sync-todo.sh` to refresh `TODO.md`.
- Project conventions: see `.claude/CLAUDE.md` (run tests + lint and fix all issues
  incl. pre-existing; manually verify on web via Playwright, port 8081 main / 8082
  worktree; login senth.wallace@gmail.com).

---

# Back-Button Navigation

Issue: [#28](https://github.com/Senth/my-musical-repertoire/issues/28)

## What

Make every in-app back affordance behave intuitively: pop history when it exists,
otherwise fall back to the screen's logical parent (hierarchy, or the practice
screen's launch source). Covers the on-screen Appbar back arrow and the Android
hardware back button. Also unifies post-save / Cancel navigation through the same
safe helper.

## Why

`router.back()` is a pure history pop. After a page reload or deep link the in-app
history is empty, so the back arrow (and a save-then-`router.back()`) silently does
**nothing** — the headline complaint in #28. There is also an inconsistency: practice
screens already route their **Done** button to a `from`-aware destination, but their
back arrow still calls `router.back()`.

The fix: a single helper — `canGoBack() ? router.back() : router.replace(fallback)` —
used everywhere. In-session, history naturally returns the user to wherever they came
from (preserving list scroll/state); only when there is no history do we deterministically
go **up one step**. This satisfies all three issue bullets without changing the pleasant
in-session behavior.

### Decisions locked during grilling

- **Model:** history-first, hierarchy/`from` fallback (NOT "always replace to parent").
  In-session back stays natural; the fallback only fires on reload / deep link.
- **Triggers in scope:** in-app Appbar back arrow **+ Android hardware back** (`BackHandler`).
  Both are reload-safe via the fallback.
- **Web browser back:** left as native. In-session it already works (each `push` adds a
  browser entry). After a *cold reload* of a deep URL the browser's own back button may
  leave the app — accepted; the on-screen back arrow always works. **No history seeding.**
- **Post-save / Cancel:** routed through the same helper (fixes the save-then-stuck trap
  on a reloaded form).
- **Post-practice labeled button** ("Back to Pieces" / "Back to Overview" — the
  `PracticeComparison` / `TechniqueLogComparison` `onDone` CTA): this is a *distinct*
  affordance from the back arrow. It always does a deterministic `router.replace` **up to
  the list/overview level** — overview if launched `from=overview`, otherwise the
  pieces/techniques **list**. It never lands on a detail page and is never converted to the
  history-first `goBack` helper.
- **Dead duplicates:** `app/(app)/add-technique.tsx` and `app/(app)/edit-technique/[id].tsx`
  are unreferenced (live screens are `technique/add.tsx` / `technique/[id]/edit.tsx`) — delete them.

## Data Model

None. Pure navigation change. No Firestore, no AsyncStorage, no new i18n strings.

## UI Flow

New hook **`hooks/use-up-navigation.ts`**:

```ts
import { useFocusEffect } from "expo-router";
import { type Href, useRouter } from "expo-router";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

/** Returns a `goBack` that pops history when possible, else replaces to `fallback`.
 *  Also intercepts the Android hardware back button (while focused) to do the same. */
export function useUpNavigation(fallback: Href): () => void {
  const router = useRouter();

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true; // handled — block default
      });
      return () => sub.remove();
    }, [goBack]),
  );

  return goBack;
}
```

- Registering the `BackHandler` inside `useFocusEffect` ensures only the focused screen
  intercepts (LIFO listeners would otherwise all fire).
- Tab screens (overview / pieces / techniques) do **not** use the hook, so the hardware
  back keeps its default root behavior (exit app).

### Per-screen fallback map

Each screen calls `const goBack = useUpNavigation(<fallback>)` and uses `goBack` for
the `Appbar.BackAction`, plus any post-save / Cancel `router.back()`.

| Screen | File | Fallback (`replace` target when no history) |
|---|---|---|
| Piece detail | `piece/[id]/index.tsx` | `/(app)/(tabs)/piece` |
| Piece section | `piece/[id]/section/[sectionId].tsx` | `/piece/${pieceId}` |
| Piece edit | `piece/[id]/edit.tsx` | `/piece/${id}` |
| Piece add | `piece/add.tsx` | `/(app)/(tabs)/piece` |
| Piece practice | `piece/[id]/practice.tsx` | `getBackDestination()` (`from`-based) |
| Technique detail | `technique/[id]/index.tsx` | `/(app)/(tabs)/technique` |
| Technique edit | `technique/[id]/edit.tsx` | `/technique/${id}` |
| Technique add | `technique/add.tsx` | `/(app)/(tabs)/technique` |
| Technique practice | `technique/[id]/practice.tsx` | `getBackDestination()` (`from`-based) |
| Session setup | `session/setup.tsx` | `/(app)/(tabs)/overview` |

Notes:
- **Practice — two distinct affordances:**
  - **Back arrow** (`Appbar.BackAction`): history-first via `useUpNavigation`, reload-fallback =
    `getBackDestination()` (kept **detail-aware**: `from=piece-detail` reload → that piece's
    detail, preserving the practiced item's context = "up one step").
  - **Labeled Done button** (`onDone`): always `router.replace(getDoneDestination())` where
    **`getDoneDestination()`** = overview when `from=overview`, else the pieces/techniques
    **list** (never a detail page). The label (`getBackLabel`, used only by this button) is
    updated to match — drop the "Back to Piece" / "Back to Technique" branch so it only ever
    reads "Back to Overview" or "Back to Pieces"/"Back to Techniques". No new i18n keys
    (existing `backToPieces` / `backToTechniques` / `backToOverview`); the now-unused
    `backToPiece` / `backToTechnique` keys may be left in place.
  - So in a single session, the arrow may pop to a detail page (natural history) while the
    Done button returns to the list — intentional: the arrow is "go back one step", the Done
    button is "finish and return to my list".
- **Edit reached from a list row** (the list has a direct "edit" action): in-session back
  pops to the list; on cold reload it falls back to the *detail* (hierarchy parent). Accepted.
- `session/coach.tsx` and `session/summary.tsx` are unchanged (they drive their own flow
  via explicit `router.replace`; no back arrow).

## Logging

None. No new signals for the recommendation engine.

## Out of Scope

- Web browser back-button behavior after a cold reload (no `window.history` seeding).
- `initialRouteName` / stack anchoring.
- Changing the `from` query-param scheme or the practice Done semantics.
- Bottom-tab hardware-back behavior.
- Coach / summary session flow.

## Phases

**Phase 1 — Hook + cleanup**
- Add `hooks/use-up-navigation.ts` as specified.
- Delete dead duplicates `app/(app)/add-technique.tsx` and `app/(app)/edit-technique/[id].tsx`.
- Confirm nothing imports/links them (already verified) and routes still typecheck.

**Phase 2 — Piece stack**
- Wire `useUpNavigation` into `piece/[id]/index.tsx`, `piece/[id]/section/[sectionId].tsx`
  (back arrow + both post-save/cancel `router.back()`), `piece/[id]/edit.tsx`
  (arrow + save-nav), `piece/add.tsx` (arrow + save-nav).
- `piece/[id]/practice.tsx`: arrow → `useUpNavigation(getBackDestination())` (detail-aware);
  add `getDoneDestination()` (overview if `from=overview` else `/(app)/(tabs)/piece`) and point
  `handleDone` at it; update `getBackLabel` to drop the `from=piece-detail` "Back to Piece" branch.

**Phase 3 — Technique stack + session setup**
- Wire `useUpNavigation` into `technique/[id]/index.tsx`, `technique/[id]/edit.tsx`
  (arrow + save-nav), `technique/add.tsx` (arrow + save-nav), `session/setup.tsx`
  (arrow + Cancel).
- `technique/[id]/practice.tsx`: arrow → `useUpNavigation(getBackDestination())` (detail-aware);
  add `getDoneDestination()` (overview if `from=overview` else `/(app)/(tabs)/technique`) and point
  `handleDone` at it; update `getBackLabel` to drop the `from=technique-detail` "Back to Technique" branch.

**Phase 4 — Verify (lint, tests, Playwright e2e)**
- Run full test suite + Biome/ESLint; fix all issues (including any pre-existing).
- Playwright (web, login senth.wallace@gmail.com) scenarios:
  1. Pieces list → piece → section → back ⇒ piece detail; back ⇒ pieces list.
  2. Overview card → piece detail → back ⇒ overview (in-session history).
  3. Pieces list → practice (`from=pieces`) → back arrow ⇒ pieces list; **Done** button ⇒ pieces list.
  4. **Piece detail → Practice** (`from=piece-detail`): back arrow (in-session) ⇒ piece detail;
     but the **Done** button ⇒ pieces **list** (label reads "Back to Pieces", never "Back to Piece").
  5. Overview card → practice (`from=overview`) → **Done** ⇒ overview.
  6. **Reload** on `/piece/<id>` → back arrow ⇒ pieces list (no-op bug fixed).
  7. **Reload** on `/piece/<id>/section/<sid>` → back arrow ⇒ piece detail.
  8. **Reload** on `/piece/<id>/practice?from=piece-detail` → back arrow ⇒ that piece's detail;
     **Done** ⇒ pieces list.
  9. Edit a piece, reload the edit form, Save ⇒ piece detail (not stuck).
  10. Equivalent technique-side spot checks (incl. Done ⇒ techniques list from `from=technique-detail`).
- (Android hardware back can't be exercised via web Playwright; verify the hook logic /
  no web regressions. Flag for manual device check.)
