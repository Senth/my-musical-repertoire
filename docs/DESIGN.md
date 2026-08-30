---
name: My Musical Repertoire
source_of_truth: theme/tokens.ts, theme/index.ts
colors:
  light:
    primary: "#7B1FA2"
    onPrimary: "#FFFFFF"
    primaryContainer: "#E1BEE7"
    onPrimaryContainer: "#21005D"
    secondary: "#9C27B0"
    onSecondary: "#FFFFFF"
    secondaryContainer: "#E8DEF8"
    onSecondaryContainer: "#1D192B"
    tertiary: "#7D5260"
    onTertiary: "#FFFFFF"
    tertiaryContainer: "#FFD8E4"
    onTertiaryContainer: "#31111D"
    error: "#B3261E"
    onError: "#FFFFFF"
    errorContainer: "#F9DEDC"
    onErrorContainer: "#410E0B"
    warning: "#B45309"
    onWarning: "#FFFFFF"
    warningContainer: "#FEF3C7"
    onWarningContainer: "#78350F"
    success: "#047857"
    onSuccess: "#FFFFFF"
    successContainer: "#D1FAE5"
    onSuccessContainer: "#064E3B"
    background: "#FFFBFE"
    onBackground: "#1C1B1F"
    surface: "#FFFBFE"
    onSurface: "#1C1B1F"
    surfaceVariant: "#E7E0EC"
    onSurfaceVariant: "#49454F"
    outline: "#79747E"
    outlineVariant: "#CAC4D0"
    inverseSurface: "#313033"
    inverseOnSurface: "#F4EFF4"
    inversePrimary: "#D0BCFF"
    surfaceDisabled: "rgba(28, 27, 31, 0.12)"
    onSurfaceDisabled: "rgba(28, 27, 31, 0.38)"
    backdrop: "rgba(50, 47, 55, 0.4)"
    elevation: { level1: "#F7F3F9", level2: "#F3EDF6", level3: "#EEE8F4" }
  dark:
    primary: "#CE93D8"
    onPrimary: "#381E72"
    primaryContainer: "#4A148C"
    onPrimaryContainer: "#EADDFF"
    secondary: "#BA68C8"
    onSecondary: "#332D41"
    secondaryContainer: "#4A4458"
    onSecondaryContainer: "#E8DEF8"
    tertiary: "#EFB8C8"
    onTertiary: "#492532"
    tertiaryContainer: "#633B48"
    onTertiaryContainer: "#FFD8E4"
    error: "#F2B8B5"
    onError: "#601410"
    errorContainer: "#8C1D18"
    onErrorContainer: "#F2B8B5"
    warning: "#FCD34D"
    onWarning: "#78350F"
    warningContainer: "#92400E"
    onWarningContainer: "#FEF3C7"
    success: "#34D399"
    onSuccess: "#064E3B"
    successContainer: "#065F46"
    onSuccessContainer: "#D1FAE5"
    background: "#1C1B1F"
    onBackground: "#E6E1E5"
    surface: "#1C1B1F"
    onSurface: "#E6E1E5"
    surfaceVariant: "#49454F"
    onSurfaceVariant: "#CAC4D0"
    outline: "#938F99"
    outlineVariant: "#49454F"
    inverseSurface: "#E6E1E5"
    inverseOnSurface: "#313033"
    inversePrimary: "#6750A4"
    surfaceDisabled: "rgba(230, 225, 229, 0.12)"
    onSurfaceDisabled: "rgba(230, 225, 229, 0.38)"
    backdrop: "rgba(50, 47, 55, 0.4)"
    elevation: { level1: "#25232A", level2: "#2C2831", level3: "#312C38" }
# The lifecycle ladder. `accent` is chip text and the card's left stripe; `tint`
# is that accent composited over the surface at this alpha for the chip fill.
lifecycle:
  performance: { light: "#8A5300", dark: "#F0B75B", tintLight: 0.18, tintDark: 0.26 }
  learning:    { light: "#6A3EA1", dark: "#D3A9F0", tintLight: 0.13, tintDark: 0.20 }
  stabilizing: { light: "#1B5E8C", dark: "#8FC6EE", tintLight: 0.10, tintDark: 0.16 }
  maintenance: { light: "#1B5E3F", dark: "#7FD1A8", tintLight: 0.08, tintDark: 0.13 }
  dormant:     { light: "#49454F", dark: "#CAC4D0", tintLight: 0.07, tintDark: 0.11 }
  retired:     { light: "#6E6A75", dark: "#98939E", tintLight: 0.00, tintDark: 0.00 }
typography:
  headlineSmall: { fontFamily: &sans 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: 24, lineHeight: 32, fontWeight: 400, letterSpacing: 0 }
  titleLarge:   { fontFamily: *sans, fontSize: 22, lineHeight: 28, fontWeight: 400, letterSpacing: 0 }
  titleMedium:  { fontFamily: *sans, fontSize: 16, lineHeight: 24, fontWeight: 500, letterSpacing: 0.15 }
  titleSmall:   { fontFamily: *sans, fontSize: 14, lineHeight: 20, fontWeight: 500, letterSpacing: 0.1 }
  bodyLarge:    { fontFamily: *sans, fontSize: 16, lineHeight: 24, fontWeight: 400, letterSpacing: 0.15 }
  bodyMedium:   { fontFamily: *sans, fontSize: 14, lineHeight: 20, fontWeight: 400, letterSpacing: 0.25 }
  bodySmall:    { fontFamily: *sans, fontSize: 12, lineHeight: 16, fontWeight: 400, letterSpacing: 0.4 }
  labelLarge:   { fontFamily: *sans, fontSize: 14, lineHeight: 20, fontWeight: 500, letterSpacing: 0.1 }
  labelMedium:  { fontFamily: *sans, fontSize: 12, lineHeight: 16, fontWeight: 500, letterSpacing: 0.5 }
  labelSmall:   { fontFamily: *sans, fontSize: 11, lineHeight: 16, fontWeight: 500, letterSpacing: 0.5 }
spacing: { none: 0, xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 }
radius: { none: 0, xs: 4, sm: 6, md: 8, lg: 12, full: 999 }
elevation: { none: 0, low: 2, high: 4 }
contentWidth: { form: 448, page: 576 }
size:
  progressBar: 6
  dot: 10
  titleOnlyCard: 50
  listRowMin: 56
  fabOffset: 24
  scrollTail: 96
icon: { sm: 18, md: 20, action: 24, tab: 28, hero: 48 }
border: { hairline: 1, accent: 4 }
touchTarget: 48
breakpoints: { compact: 600 }
density: comfortable
components:
  page-frame:
    file: components/ui/ScreenContent.tsx
    paddingHorizontalCompact: "{spacing.md}"
    paddingHorizontalRoomy: "{spacing.lg}"
    paddingTop: "{spacing.lg}"
    maxWidth: "{contentWidth.page}"
  state-chip:
    file: components/ui/StateChip.tsx
    typography: "{typography.labelSmall}"
    letterSpacing: 0.3
    rounded: "{radius.sm}"
    textMarginHorizontal: 9
    textMarginVertical: 3
    backgroundColor: "lifecycle accent at its tint alpha"
    textColor: "lifecycle accent"
    borderColor: "{colors.outlineVariant} when outlined, else none"
  piece-card:
    file: components/ui/card-style.ts
    borderLeftWidth: "{border.accent}"
    borderLeftColor: "lifecycle accent (0.35 alpha when retired)"
    titleFontSize: 17
    titleFontWeight: 500
    subtitleColor: "onSurfaceVariant, both schemes"
  progress-bar:
    file: components/ui/PieceProgressBar.tsx
    height: "{size.progressBar}"
    rounded: "{radius.full}"
---

# Design contract

**`theme/tokens.ts` and `theme/index.ts` are the source of truth. This file is the rules.**
Neither file exists yet: they arrive with the NativeWind removal (#127), and this contract
was written first so that refactor has a scale to convert 163 `className` uses *to* rather
than inventing one halfway through. Every number in the front matter above was read out of
the app as it stands today — the Tailwind classes resolved to their computed pixels, the
palette resolved through `react-native-paper`'s MD3 baseline and the overrides in
`app/_layout.tsx`. Once `theme/tokens.ts` exists it is right and this file is the
transcription; when they disagree, say the contract is stale rather than editing the code
to match.

The front matter mirrors those files' key names on purpose, so the two can be diffed by eye,
and that costs it a clean `npx @google/design.md lint`. Four findings are expected and are
not to be "fixed": `colors` is split into `light` and `dark` because the app has two palettes
and neither is derived from the other; the scale is `radius`, not the schema's `rounded`,
because that is what the code will call it; `lifecycle`, `size`, `border` and `contentWidth`
are extension keys the schema does not resolve `{…}` references into; and every colour role
is reported as orphaned because an MD3 role palette is not referenced component-by-component.
Read the code, not the linter, on those four.

**Nobody edits this file mid-run.** A review finding cites a rule here or says in words that
it is a taste call. Proposed rule changes are collected as one diff for the human. Widening
a rule so that the change in front of you passes is the failure this sentence exists to
prevent.

## 1. Identity

My Musical Repertoire decides what a pianist should practise next, and then gets out of the
way while they practise it. The screen is read at arm's length, on a phone in a stand above
the keys, by someone with one hand free at most — and read in short bursts between
run-throughs, not browsed. Every judgement below follows from that: a title must survive a
glance, a control must survive a thumb, and anything decorative is costing a beat of
practice time. The cast that stresses this is in [`PERSONAS.md`](PERSONAS.md); Rasmus is
the one who fails a design decision fastest, and Margit is the one who decides whether the
words on it are true.

## 2. Direction

Material 3 through `react-native-paper`, in a purple that is the app's own rather than
Material's stock `#6750A4`, and deliberately low-chrome: flat surfaces, hairline dividers,
one elevated card style, no gradients, no decorative iconography. It departs from stock MD3
in exactly one place, and does it on purpose — colour is spent almost entirely on the
lifecycle ladder in `utils/state-colors.ts`, so that a list of sixty pieces reads
title-first and the state chips stay complementary rather than competing. That restraint is
the design. An app for David's sixty live pieces cannot afford six equally loud badges.

## 3. Colour

- **Primary** (`#7B1FA2` / `#CE93D8`) marks the single primary action on a screen — Practice,
  Start session, Sign in — plus links and the focus ring. Never decoration, never status,
  never a large fill behind text. One filled primary button per screen; a second action on
  the same screen is `mode="outlined"` or `mode="text"`.
- **Secondary and tertiary** are Paper's, and are effectively unused. Reaching for them is a
  sign the screen wants a hierarchy it has not earned; use `onSurfaceVariant` instead.
- **`onSurfaceVariant`** is the app's muted role: composer lines, bar ranges, "Never
  practiced", helper text, every piece of metadata under a title. If text is not the thing
  being read first, it is this colour.
- **`outlineVariant`** is the single border colour, at `border.hairline`. One weight
  throughout. `outline` is for non-text borders only — at 4.44:1 on light surface it clears
  the 3:1 non-text floor and does not clear 4.5:1, so it may never carry a glyph or a label.
- **Warning and success** are non-MD3 roles this app adds (`app/_layout.tsx`) and exist for
  two things only: the offline bar (`warningContainer`) and a mistake-count trend
  (`SectionDetailRow`). Always paired with an icon or a word, never colour alone. Because
  they are not in Paper's `MD3Theme`, both files today re-declare their own `AppTheme`
  intersection type to reach them — **that duplication is what `theme/index.ts` exists to
  end**: one typed `useAppTheme()`, and the two schemes defined beside it rather than inline
  in `app/_layout.tsx`.
- **Error** is Paper's, and is for a failed write or an invalid field — not for "you have
  not practised this in six weeks". Decay is not an error; it is the app's normal subject.

Surfaces separate from the background by **elevation, not by border** — `background` and
`surface` are the same colour in both schemes, so a card is legible because it is lifted, and
the `elevation.level1–3` tints are what does the lifting. A card with both a shadow and a
full outline is a defect; the left accent stripe is not an outline and is allowed.

### The lifecycle ladder

Six states share three hues across pieces, techniques and section phases, so a phase and a
piece state that mean the same thing look the same. Tint alpha, not hue, encodes how much
attention the state deserves: performance `0.18` → dormant `0.07` in light, `0.26` → `0.11`
in dark, because a dark surface needs more alpha to read as the same amount of colour.
Retired and shelved drop the fill entirely and take a hairline, so they stay hindmost.

Every accent-on-tint pair clears WCAG AA as text (measured: 4.75:1 at the loudest, 8.14:1 at
the quietest). **The tints may not be raised without re-measuring** — `0.18` is already the
ceiling that keeps performance readable on its own fill.

### Dark mode

Two palettes, not an inversion: MD3's baseline dark roles with the purple identity swapped
for its light-on-dark counterpart (`#CE93D8` on `#4A148C`). `onPrimary` stays MD3's
`#381E72`, inherited rather than chosen — it measures 5.50:1 against the override, which is
the lowest text pair the app ships and the floor any future primary must also clear.

## 4. Typography

**Use Paper's `variant` prop. A `fontSize` in a style prop is a defect** with exactly one
sanctioned exception, and the front matter names it.

`bodySmall` is the workhorse — every metadata line under a title. `bodyMedium` and
`bodyLarge` are body copy. `titleMedium` and `titleSmall` are section headings inside a
screen; `headlineSmall` is a screen's own title in its content, and `titleLarge` belongs to
the app bar. `labelLarge` / `labelMedium` are button and control labels; `labelSmall` is the
chip.

The exception: **`CARD_TITLE_STYLE` at 17/500** (`components/ui/card-style.ts`). Paper's
`Card.Title` renders title and subtitle at the same weight and colour, which flattens a
piece card into two equal lines. 17 is a half-step above `titleMedium` and is what makes the
piece title beat its composer. It lives in one file and is the only place it may live.

Two weights: 400 for body, 500 for titles, labels and chips. There is no third.

## 5. Layout and spacing

**The horizontal page inset is 16 compact / 24 roomy, chosen once per screen, and
[`ScreenContent`](../components/ui/ScreenContent.tsx) is its canonical implementation.** A
screen that renders its own page padding is a defect; a screen that renders none is the
defect this rule exists to catch.

**The one exception is the full-bleed list.** A `FlatList` with `ItemSeparatorComponent`
cannot sit inside `ScreenContent`'s `ScrollView` without breaking virtualisation, so it opts
out — and then pays the same 16/24 inset **inside the row**, so its text lines up with every
other screen while the divider runs edge to edge. `app/(app)/(tabs)/piece.tsx` is the
reference for this; a full-bleed list that also insets its dividers, or a row that pays a
different number, is wrong.

Content clamps at `contentWidth.page` (576) and centres — a practice log stretched across a
monitor is a log nobody can scan. Auth screens clamp tighter at `contentWidth.form` (448).

The scale is a 4pt grid — **4 · 8 · 12 · 16 · 24 · 32 · 48** — named `xxs` through `xxl`. It
has one step more than the sibling repo's, because 12 is load-bearing here: roughly two dozen
call sites use it as the gap inside a group of related rows. So the names start a step lower
and `md` lands on 16, which is the page inset and the app's most common padding. The two
repos share this vocabulary and never the numbers; read the value, not the key, when moving
between them.

Proximity is the rule that settles spacing arguments: **the gap between groups is visibly
larger than the gap within one.** In practice that is `xs` (8) inside a row, `sm` (12)
between related rows, `lg` (24) between sections of a screen. A screen that uses one value
for two of those has lost its structure.

`size.scrollTail` (96) is the bottom padding a scroll view needs when a FAB floats over it.
**A FAB overlapping the last item is a defect** — visible today on Overview.

## 6. Components

New work extends these. Restyling a copy is a defect.

| Component | Canonical file | Notes |
|---|---|---|
| Page frame | `components/ui/ScreenContent.tsx` | 16/24 inset, 576 band, `paddingTop` 24 |
| Form frame | `components/ui/FormScaffold.tsx` | the frame plus save/cancel |
| Lifecycle chip | `components/ui/StateChip.tsx` | `StateChip` for state, `MetaChip` for a colourless tag |
| Piece card | `components/ui/card-style.ts` | accent stripe, 17/500 title |
| Progress | `components/ui/PieceProgressBar.tsx` | 6 tall, pill |
| Loading / empty | `components/ui/CenteredScreen.tsx` | never a bare `ActivityIndicator` |
| Errors | `components/ui/ErrorSnackbar.tsx` | one per screen |
| Text field | `components/ui/FormTextField.tsx` | Paper `TextInput`, with `HelperText` |
| Row overflow | `components/ui/RowActionsMenu.tsx` | three-dot menu on a row |

Chip geometry is shared on purpose so that a state chip and a meta chip never look like two
different components side by side. Both are `labelSmall` at `radius.sm`, and both take the
same 9/3 text insets — those two numbers are what shrink Paper's `compact` Chip to the
height this app wants, and they are component values, not scale values. Letter-spacing is
`0.3` rather than `labelSmall`'s `0.5`: the one deliberate deviation, kept because widening
it pushes a six-character state label past the title's left edge.

## 7. Hierarchy: the title always wins

One dominant element per surface, and on a piece card that is the title. Reading order is
fixed: **title → composer → state → progress → recency**. Anything that would out-weigh the
title — a bigger chip, a saturated fill, a second 17px line — is wrong even when it is
individually pretty.

Density is comfortable, with one deliberate step down at the compact breakpoint (600): below
it, lists render as full-bleed rows with hairline dividers; above it, as elevated cards in
the centred band. Those are two densities of one design, not two designs.

A screen answers "why this now?" before it answers anything else. A suggestion card that
shows what to practise without the one-line reason is incomplete — that line is Margit's
fourth standing position, and it is a design requirement, not copy.

## 8. States

- **Empty** states say what the screen is for and offer the action that fills it. "No pieces
  yet" alone is not an empty state. `icon.hero` (48) is the only place a 48px glyph belongs.
- **Loading** is `LoadingScreen`, full-screen and centred, on the theme background.
- **Offline** is the persistent `OfflineBar` in `warningContainer` above every screen,
  including login. This app is used where there is no wifi, so offline is a normal state and
  must never read as an error.
- **Error** messages say what failed and what to do next, in a `Snackbar`, in `t()`.
- **Overflow**: a title truncates to one line with an ellipsis; a chip row wraps. **The page
  never scrolls sideways** — `e2e/craft.spec.ts` measures this on every route. A
  `SegmentedButtons` row with five options does not fit 390px and must not be used there.

## 9. Motion

Paper's defaults, and almost nothing else. What animates: the FAB, snackbar entry, menu and
dialog transitions, the progress bar. What does not: lists, cards, chips, screen content.
A metronome beat animation is the one place a custom animation is warranted (#39) and it
must honour `prefers-reduced-motion`, because it is the one thing on screen while somebody
is trying to concentrate.

## 10. Accessibility

- **Contrast floor is WCAG AA** (4.5:1 text, 3:1 non-text). Every pair in the front matter is
  measured and passes; the lowest is `onPrimary` on dark `primary` at 5.50:1.
- **Touch target minimum is 48dp**, and this is a rule, not an aspiration. Paper does not
  give it for free: `Button` renders 40dp, `IconButton` and `Appbar.Action` 40dp, and the
  buttons inside `Dialog.Actions` 38dp. Pass `contentStyle={{ minHeight: touchTarget }}` to
  a Paper button, and set `minWidth`/`minHeight` on a custom pressable. A `StateChip` with
  an `onPress` is a control and must meet the floor; a chip without one is a label and need
  not. **The app fails this today on every route** — that is #113's job, and the assertion
  in `e2e/craft.spec.ts` turns on inside that PR rather than being tuned to today's
  shortfall. Rasmus taps one-handed at arm's length; this is the rule his review cites.
- **Colour is never the only signal.** Every lifecycle state carries its name in the chip.
- **Every user-facing string goes through `t()`.** An untranslated key on screen is measured.
- Keyboard operation and a visible focus ring are required on web.

## 11. Anti-patterns

- **No NativeWind, no Tailwind class, no `className`.** The utility layer, `global.css`,
  the metro and postcss wiring and the three dependencies all come out; reintroducing any
  of them is a defect regardless of how small.
- **No `StyleSheet.create`.** Style props built from tokens, as Paper components take them.
- **No numeric literal in a style prop, and no colour literal outside `theme/`.** Extend the
  scale rather than inlining. `yarn invariants` is where this becomes greppable.
- No `fontSize` outside `CARD_TITLE_STYLE` and the chip.
- No card inside a card. No outline on an elevated surface.
- No second filled primary button on a screen.
- No emoji in the UI. `session/summary.tsx` currently renders `⤬ ✓ ·` as text — those are
  glyphs standing in for icons and should be icons.
- No progress ring, sparkline or metric tile. Progress here is one 6px bar and a number.
- No nagging copy. Lena deletes an app that opens by telling her she is doing it wrong.
- No screen that renders its own page padding instead of using the frame.

## 12. Verification

- **Run the app:** `scripts/dev-stack.sh up` → `http://localhost:8055` (emulator-backed,
  fixture account `pianist@example.com` / `practice123`). The hand-driven dev server is
  `yarn web` → `http://localhost:8053` and talks to the real dev project — use the emulator
  stack for design checks.
- **Representative routes:** `/overview` (the ladder, the suggestion card, the FAB overlap),
  `/piece` (both densities either side of 600), `/piece/<id>` (the frame, and the screen
  that currently has none), `/piece/<id>/practice` (the logging form, at-the-piano), `/login`.
- **Viewports:** 390 phone, 1280 desktop.
- **Schemes:** light and dark, both.
- **Measured, not judged:** `e2e/craft.spec.ts` walks every route in `e2e/support/app.ts`
  and asserts horizontal overflow, untranslated keys and a clean console. Anything a machine
  can measure belongs there rather than in a review.

## Known drift

The contract describes the target. What the app does not yet do, as of this file:

- Piece detail (`app/(app)/piece/[id]/index.tsx`) renders no page inset at all — text sits
  flush on the screen edge and the Practice button runs edge to edge. (#31)
- Desktop screens that do not clamp to `contentWidth.page`. (#26)
- Touch targets below 48dp on every route. (#113)
- The FAB overlaps the last card on Overview.
- `SegmentedButtons` overflows the right edge at 390px on the practice screen.
- 163 `className` uses across 40 files, and `theme/tokens.ts` does not exist. (#127)

None of this is fixed here. Each is an issue, and the gates that measure them turn green
inside the PR that pays them off — not by loosening a rule.

## Decisions

Append-only. Date, decision, rationale, and which surface prompted it.

- **2026-08-30** — Scale derived from the resolved Tailwind classes rather than designed
  fresh: 4 · 8 · 12 · 16 · 24 · 32 · 48. The refactor that removes NativeWind is then a
  mapping, not a redesign. It needs one name more than home-backlog's scale, so the t-shirt
  sizes start at `xxs` and `md` lands on the 16 page inset — rather than wedging an awkward
  half-step name into the middle to keep the two files numerically aligned. They were never
  meant to be: the repos share the vocabulary, not the values. (from: the whole app)
- **2026-08-30** — 48dp touch target stated as binding although the app fails it everywhere.
  A contract tuned to today's shortfall cannot be cited against tomorrow's. (from: #113)
- **2026-08-30** — The page inset is stated as a number with `ScreenContent` as its canonical
  implementation, rather than as "wrap every screen in `ScreenContent`". A full-bleed list
  must opt out of the frame's `ScrollView` to keep virtualisation, so the rule has to be
  something the list can still obey. (from: /piece, /piece/<id>)
- **2026-08-30** — Chip geometry kept at 9/3 insets and `letterSpacing: 0.3` rather than
  normalised onto the scale. The values are what shrink Paper's compact Chip to this app's
  height; normalising them would change how every list looks inside a refactor that is
  meant to change nothing visually. (from: /piece, /overview)
