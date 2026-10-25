# Design contract

## Overview

My Musical Repertoire decides what a pianist should practise next, then gets out of the way
while they practise it. The main screen's job is to answer **"why this now?"** first.

It is read at arm's length, on a phone in a stand above the keys, with one hand free at
most: a title has to survive a glance, a control a thumb, and anything decorative costs
practice time. The cast is in [`PERSONAS.md`](PERSONAS.md).

## Character

**Quiet, honest, fast.** David has sixty pieces alive at once. Margit stops trusting every
recommendation after one she would not have made. Rasmus is mid-session.

**This must never look like:**

- **A streak app.** No streak counters, flames, badges, XP, levels, confetti, or any praise
  the practice did not earn. Never nag: not in a nudge, an empty state or a summary.
- **An enterprise tool.** No dense toolbars, no nested tabs, no settings drawer per screen.
- **A landing page.** No hero sections, gradient meshes, decorative illustration, display
  type, or cards that exist only to look like cards.

## Where the values live

[`theme/tokens.ts`](../theme/tokens.ts) is ground truth for the scale (space, radius, width,
size). Palettes live in `theme/index.ts`, the lifecycle set in
[`utils/state-colors.ts`](../utils/state-colors.ts). When a value file and this document
disagree, **the file is right and this document is stale**. Say so rather than editing code
to match prose.

**The accent is teal.** A replacement must stay visibly distinct from all four ladder hues
at once and clear the lowest shipped text pair against its own on-colour.

## Token roles

- **surface** — where the page sits. Identical to the background in both schemes.
- **surface-raised** — cards, menus, sheets. An elevation tint, not a different colour.
- **outline / outlineVariant** — `outlineVariant` is the hairline divider, and is too faint
  to carry meaning: it may never be the only thing marking a control's edge. `outline` is
  the border that can. Only `outline` may carry a glyph, a secondary one clearing 3:1
  contrast. Neither carries a label.
- **onSurface** — the thing being read first. Titles, values, body copy.
- **onSurfaceVariant** — the muted role, and the workhorse: composer lines, bar ranges,
  helper text, every piece of metadata under a title.
- **primary** — the single primary action on a screen, plus links and the focus ring. Never
  decoration, never status, never a large fill behind running text. One filled primary
  button per screen; a second action is outlined or text.
- **secondary / tertiary** — never reached for directly; reaching for one means the screen
  wants a hierarchy it has not earned. `secondaryContainer` is the exception: Paper renders
  `mode="contained-tonal"` from it, so keep it a muted tint of the accent.
- **success / warning** — non-MD3 roles, for the offline bar, a mistake-count trend and a
  flagged mistake, and nothing else. Always paired with an icon or a word.
- **error** — a failed write or an invalid field. **Decay is not an error.**

### The lifecycle set

Six states shared across pieces, sections and techniques, so that a section and a piece
meaning the same thing look the same. Two rules, both binding:

1. **Hue identifies the state.** One hue per state, the same hue wherever that state
   appears. A new state takes a hue from this set or extends it deliberately; it never
   borrows the accent.
2. **Tint alpha encodes attention, and its order is fixed.** The chip fill is the state's
   own hue over the card at a low alpha, descending
   `performance → learning → stabilizing → maintenance → dormant`, with the quietest states
   dropping the fill for a hairline. The **values are tunable** — raising performance and
   learning together is fine. The **ordering is not**: performance may never sit at or below
   learning, and so on down; it keeps sixty cards reading title-first.

Every accent-on-tint pair is text and must clear the text floor on its surface; raising an
alpha means re-measuring it.

**Themes.** Two palettes, not an inversion: dark takes MD3's dark roles, and the lifecycle
alphas run higher throughout.

## Surfaces and elevation

**Surfaces separate by elevation, not by border.** A card carrying both a shadow and a full
outline is a defect. The left accent stripe is not an outline and is allowed.

**No card inside a card.** Menus, dialogs, sheets and snackbars float; static content does not.

## Typography

- **Families** — the system sans, two weights. No display face, second family or mono role.
- **Sizes** — Paper's MD3 variants, via the `variant` prop. **A `fontSize` in a style prop
  is a defect**, with one sanctioned exception that lives in
  [`card-style.ts`](../components/ui/card-style.ts) and may live nowhere else: Paper's
  `Card.Title` renders title and subtitle at the same weight and colour, so pair it with
  `CARD_TITLE_STYLE` or the card flattens into two equal lines.
- **Weights** — two: regular for body, medium for titles, labels and chips. On one surface,
  three variants, four at the outside.
- **The muted line is the small body variant.** Every metadata line under a title uses it.

## Space and density

- **Base** — a 4pt grid, named `xxs` through `xxl` in the token file. Extend the scale
  rather than inlining a number between two steps.
- **Density** — comfortable, one step down below the compact breakpoint: full-bleed rows
  with hairline dividers there, elevated cards in the centred band above it.
- **Page** — one horizontal inset, chosen once per screen from the compact/roomy pair, with
  [`ScreenContent`](../components/ui/ScreenContent.tsx) as its canonical implementation.
  Content clamps to the page width and centres; auth screens clamp to the form width.
  - **A screen that renders its own page padding is a defect. A screen that renders none is
    the defect this rule exists to catch.**
  - **The one exception is the full-bleed list.** A `FlatList` with a separator cannot sit
    inside the frame's `ScrollView`, so it opts out and pays the same inset *inside the
    row*. `app/(app)/(tabs)/piece.tsx` is the reference.
- **Layout** — flow plus a max width. No column grid.

**The gap between groups is visibly larger than the gap within one** — the smallest step
inside a row, one step up between related rows, a large step between sections.

A scroll view with a FAB over it pays the scroll-tail padding. **A FAB overlapping the last
item is a defect.**

## Shape

- **Radius** — four steps, chosen by what the thing is, not by taste: the smallest for the
  progress bar and hairline wells, one step up for chips, the card step for cards, sheets
  and dialogs, and full for buttons, the FAB and the search field. Nothing between steps.
- **Borders** — one weight, `outlineVariant`, only where elevation cannot do the job.
  **Texture** — none: no grain, noise, gradient or pattern.

## Components

The canonical implementation owns the styling. Extend it. **Restyling a copy is a defect.**

| Component | Canonical file |
|---|---|
| Page frame | [`components/ui/ScreenContent.tsx`](../components/ui/ScreenContent.tsx) |
| Form frame | [`components/ui/FormScaffold.tsx`](../components/ui/FormScaffold.tsx) |
| Lifecycle chip, metadata tag | [`components/ui/StateChip.tsx`](../components/ui/StateChip.tsx) |
| Piece card | [`components/ui/card-style.ts`](../components/ui/card-style.ts) |
| Progress | [`components/ui/PieceProgressBar.tsx`](../components/ui/PieceProgressBar.tsx) |
| Loading / empty | [`components/ui/CenteredScreen.tsx`](../components/ui/CenteredScreen.tsx) |
| Errors | [`components/ui/ErrorSnackbar.tsx`](../components/ui/ErrorSnackbar.tsx) |
| Text field | [`components/ui/FormTextField.tsx`](../components/ui/FormTextField.tsx) |
| Row overflow | [`components/ui/RowActionsMenu.tsx`](../components/ui/RowActionsMenu.tsx) |

- **Reach for a `react-native-paper` component first.** A style prop built from the token
  file is the second choice. There is no third: no `StyleSheet.create`, no `className`, no
  colour literal outside the value files, no bare number in a style prop.
- **Chips** — `StateChip` carries lifecycle meaning and colour; `MetaChip` is a colourless
  tag. They share geometry, and a tag reaching for `StateChip` steals the ladder's colour.
- **Buttons** — filled for the one primary action, outlined for a real second action, text
  for anything tertiary, and Paper's error colour for destructive.
- **Control height** — Paper's own sizes, no padding added for reach. A web touch handler
  keeps 48dp around each control's centre free of other controls.
- **Forms** — Paper's `TextInput` with its floating label, helper text and errors below the
  field. Required is the norm, so mark the optional ones.
- **Focus ring** — in the accent, and it has to clear both schemes.
- **Icons** — **MaterialCommunityIcons only**, via Paper's `icon="…"` prop wherever a Paper
  component takes one. It is the only set carrying this app's domain glyphs. Never an emoji
  as a glyph.
- **Empty states** — say what the screen is for and offer the action that fills it. Text and
  one icon; never an illustration.
- **Charts** — hand-drawn with `react-native-svg`; no chart library. Lines, not dots. Hue
  identifies a series, never a judgement: left hand `handLeft`, right hand `handRight`,
  hands together `onSurface`, and every line is end-labelled. How a practice went is line
  width — clean 1, some slips 2, shaky 4. Targets are a dashed `outline` line. Lifecycle
  hues never colour a series.

## Motion

Functional. Paper's defaults and almost nothing else, on transform and opacity only.

**Animates:** what the user interacts with, and anything new that appears on a page already
on screen unasked. **Never animates:** lists, cards, chips, screen content, or anything the
user asked for on entry.

## Voice

- **Register** — plain, specific, active. Say the thing.
- **Capitalisation** — **sentence case throughout**: headings, buttons, labels, menu items.
  Proper nouns and document titles keep their capitals (Privacy Policy, Terms of Service),
  and so do initialisms (BPM).
- **Banned** — the enterprise register ("task", "item", "entry", "allocation") and the
  streak register (any copy that praises, scolds, or counts days missed).
- **Every recommendation answers "why this now?" in one line a student can read.** A
  suggestion card without it is incomplete.
- **The title wins.** Reading order on a piece card is fixed: title, composer, state,
  progress, recency.
- **Offline is not an error** — this app is used where there is no wifi, so it is a normal
  state, in the warning role.

## Robustness

- **Breakpoints** — one, `breakpoints.compact`, and it breaks on content rather than on a
  device name. Below it: full-bleed rows, the tab bar, one column.
- **Overflow** — a title truncates to one line with an ellipsis; a chip row wraps. **The page
  never scrolls sideways**; `e2e/craft.spec.ts` measures that on every route. A control
  with five options does not fit a phone.

## Verification

Judge `/overview`, `/piece` and `/piece/<id>/practice` in both schemes, phone and desktop;
measurable checks belong in `e2e/craft.spec.ts`.
