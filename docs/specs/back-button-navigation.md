# Back-button navigation

Tracking issue: [#28](https://github.com/Senth/my-musical-repertoire/issues/28)

## 1. What

Every in-app back affordance pops history when it exists and otherwise falls back
to the screen's logical parent — the hierarchy, or for practice screens the
`from` launch source. Covers the on-screen Appbar back arrow and the Android
hardware back button, and routes post-save / Cancel navigation through the same
helper.

## 2. Why

`router.back()` is a pure history pop. After a page reload or a deep link the
in-app history is empty, so the back arrow — and any save-then-`router.back()` —
silently did **nothing**. That was the headline complaint in #28.

There was also an inconsistency: practice screens already routed their **Done**
button to a `from`-aware destination while their back arrow still called
`router.back()`.

One helper — `canGoBack() ? router.back() : router.replace(fallback)` — fixes
both. In-session, history naturally returns the user to wherever they came from,
preserving list scroll and state; only when there is no history does the app
deterministically go **up one step**.

### Decisions locked

- **History-first with a hierarchy/`from` fallback**, not "always replace to
  parent". In-session back stays natural; the fallback fires only on reload or
  deep link.
- **Web browser back is left native.** In-session it already works, since each
  `push` adds a browser entry. After a cold reload of a deep URL the browser's
  own back button may leave the app — accepted, because the on-screen arrow
  always works. **No history seeding.**
- **Post-save / Cancel** go through the same helper, which fixes the
  save-then-stuck trap on a reloaded form.

## 3. Data model

None. Pure navigation. No Firestore, no AsyncStorage, no new i18n strings.

## 4. The hook

```ts
// hooks/use-up-navigation.ts
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
        return true;   // handled — block default
      });
      return () => sub.remove();
    }, [goBack]),
  );

  return goBack;
}
```

Registering the `BackHandler` inside `useFocusEffect` ensures only the focused
screen intercepts; LIFO listeners would otherwise all fire. Tab screens
(overview / pieces / techniques) deliberately do **not** use the hook, so the
hardware back keeps its default root behaviour of exiting the app.

The `Platform.OS === "android"` guard also means the hook never touches web,
which matters: `react-native-web`'s `BackHandler` is a no-op stub that only
`console.error`s. Web back interception needs a `popstate` sentinel instead —
that is the coach exit guard in [`pwa-support.md`](pwa-support.md).

## 5. Per-screen fallbacks

Each screen calls `const goBack = useUpNavigation(<fallback>)` and uses `goBack`
for its `Appbar.BackAction` and for any post-save or Cancel navigation.

| Screen | Fallback (`replace` target when no history) |
| --- | --- |
| Piece detail | `/(app)/(tabs)/piece` |
| Piece section | `/piece/${pieceId}` |
| Piece edit | `/piece/${id}` |
| Piece add | `/(app)/(tabs)/piece` |
| Piece practice | `getBackDestination()` (`from`-based) |
| Technique detail | `/(app)/(tabs)/technique` |
| Technique edit | `/technique/${id}` |
| Technique add | `/(app)/(tabs)/technique` |
| Technique practice | `getBackDestination()` (`from`-based) |
| Session setup | `/(app)/(tabs)/overview` |

### Practice screens have two distinct affordances

- **Back arrow** — history-first via `useUpNavigation`, with a **detail-aware**
  reload fallback: `from=piece-detail` reloaded lands on that piece's detail,
  preserving the practised item's context, which is what "up one step" means.
- **Labeled Done button** — always `router.replace(getDoneDestination())`:
  overview when `from=overview`, otherwise the pieces/techniques **list**. It
  never lands on a detail page and is never converted to the history-first
  helper. The label follows: it only ever reads "Back to Overview" or "Back to
  Pieces"/"Back to Techniques".

So within one session the arrow may pop to a detail page while Done returns to
the list. That is intentional: the arrow means "go back one step", the Done
button means "finish and return to my list".

**Edit reached from a list row** (where the list has a direct edit action) pops
to the list in-session and falls back to the *detail* on a cold reload. Accepted.

`session/coach.tsx` and `session/summary.tsx` are unchanged — they drive their
own flow via explicit `router.replace` and have no back arrow. The coach has its
own web exit guard.

## 6. Logging

None.

## 7. Out of scope

- **Web browser back behaviour after a cold reload** — no `window.history`
  seeding.
- **`initialRouteName` / stack anchoring.**
- **Changing the `from` query-param scheme** or the practice Done semantics.
- **Bottom-tab hardware-back behaviour.**
- **The coach / summary session flow**, which owns its own navigation.
