# Design contract

## Overview

My Musical Repertoire decides what a pianist should practise next, then gets out of the way
while they practise it. One person at a time, most days, in short bursts between
run-throughs. The main screen's job is to answer **"why this now?"** before anything else.

Every rule below follows from that. The screen is read at arm's length, on a phone in a
stand above the keys, by someone with one hand free at most: a title has to survive a
glance, a control has to survive a thumb, and anything decorative costs practice time. The
cast that stresses this is in [`PERSONAS.md`](PERSONAS.md).

## Character

**Quiet, honest, fast.** Quiet because David has sixty pieces alive at once. Honest because
Margit stops trusting every recommendation after one she would not have made. Fast because
Rasmus is mid-session and the app is not the point.

**This must never look like:**

- **A streak app.** No streak counters, flames, badges, XP, levels, confetti, or any praise
  the practice did not earn. Lena is doing the honest thing by showing up, and an app that
  celebrates or scolds her for it is one she deletes on a bad week.
- **A fitness dashboard.** No progress rings, radial gauges, metric tiles, sparklines,
  scores out of a hundred, or week-over-week deltas. Progress here is one bar and a word.
- **An enterprise tool.** No dense toolbars, no nested tabs, no settings drawer per screen —
  and not its vocabulary: never "task", "item", "entry", "allocation".
- **A landing page.** No hero sections, gradient meshes, decorative illustration, display
  type, or cards that exist only to look like cards.

## Where the values live

`theme/tokens.ts` is ground truth, and **does not exist yet** — it arrives with #127, the
change that moves this app off NativeWind. Until then the values live in two files that do:
[`app/_layout.tsx`](../app/_layout.tsx) for the palette, and
[`utils/state-colors.ts`](../utils/state-colors.ts) for the lifecycle set.

When a value file and this document disagree, **the file is right and this document is
stale**. Say so rather than editing code to match prose.

**The accent is provisional.** The current purple was a first pick, not a decision, and a
colour investigation is still owed — so this document says what the accent *does* and what a
replacement must clear, never which purple it is. Two constraints on a candidate: it clears
the app's lowest shipped text pair against its own on-colour, and it stays visibly distinct
from the `learning` hue, which today sits close enough to the brand purple that a chip and a
button can be mistaken for each other.

## Token roles

- **surface** — where the page sits. Identical to the background in both schemes, on
  purpose; see *Surfaces*.
- **surface-raised** — cards, menus, sheets. An elevation tint, not a different colour.
- **outline / outlineVariant** — `outlineVariant` is the hairline divider, and is too faint
  to carry meaning: it may never be the only thing marking a control's edge. `outline` is
  the border that can. Neither ever carries a glyph or a label.
- **onSurface** — the thing being read first. Titles, values, body copy.
- **onSurfaceVariant** — the app's muted role, and its workhorse: composer lines, bar
  ranges, "Never practiced", helper text, every piece of metadata under a title. If text is
  not what gets read first, it is this.
- **primary** — the single primary action on a screen (Practice, Start session, Sign in),
  plus links and the focus ring. Never decoration, never status, never a large fill behind
  running text. One filled primary button per screen; a second action is outlined or text.
- **secondary / tertiary** — Paper's, and effectively unused. Reaching for one means the
  screen wants a hierarchy it has not earned. Use `onSurfaceVariant`.
- **success / warning** — non-MD3 roles this app adds. They exist for the offline bar and
  for a mistake-count trend, and for nothing else. Always paired with an icon or a word.
- **error** — a failed write or an invalid field. **Decay is not an error.** "You have not
  practised this in six weeks" is the app's normal subject, not a fault condition.

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
   learning, and so on down. That ordering is what keeps sixty cards reading title-first
   instead of as confetti.

Every accent-on-tint pair is text and must clear the text floor on the surface it sits on.
Raising an alpha means re-measuring that pair, not assuming it still passes.

**Themes.** Both, as two palettes rather than an inversion. Dark is not light with the
lightness flipped: it takes MD3's dark roles, and the lifecycle alphas run higher throughout,
because a dark surface swallows colour at the alpha a light one needs.

## Surfaces and elevation

**Surfaces separate by elevation, not by border.** Background and surface are the same
colour in both schemes, so a card is legible because it is lifted. A card carrying both a
shadow and a full outline is a defect. The left accent stripe is not an outline and is
allowed.

One level of nesting. **No card inside a card.** Menus, dialogs, sheets and snackbars float;
static content does not.

## Typography

- **Families** — the system sans, one family across two weights. No display face, no second
  family, and no mono role: there is no code, no ID and no numeric column here, and a BPM
  reads fine in the body face.
- **Sizes** — Paper's MD3 variants, via the `variant` prop. **A `fontSize` in a style prop
  is a defect**, with one sanctioned exception that lives in
  [`card-style.ts`](../components/ui/card-style.ts) and may live nowhere else: Paper's
  `Card.Title` renders title and subtitle at the same weight and colour, which flattens a
  piece card into two equal lines, and that half-step is what makes the title beat its
  composer.
- **On one surface** — three variants, four at the outside.
- **Weights** — two: regular for body, medium for titles, labels and chips.
- **The muted line is the small body variant.** Every metadata line under a title uses it.

## Space and density

- **Base** — a 4pt grid, named `xxs` through `xxl` in the token file. Extend the scale
  rather than inlining a number between two steps.
- **Density** — comfortable, with one deliberate step down below the compact breakpoint.
  Below it, lists are full-bleed rows with hairline dividers; above it, elevated cards in the
  centred band. Those are two densities of one design, not two designs.
- **Page** — one horizontal inset, chosen once per screen from the compact/roomy pair, with
  [`ScreenContent`](../components/ui/ScreenContent.tsx) as its canonical implementation.
  Content clamps to the page width and centres; auth screens clamp tighter to the form width.
  A practice log stretched across a monitor is a log nobody can scan.
  - **A screen that renders its own page padding is a defect. A screen that renders none is
    the defect this rule exists to catch.**
  - **The one exception is the full-bleed list.** A `FlatList` with a separator cannot sit
    inside the frame's `ScrollView` without breaking virtualisation, so it opts out and pays
    the same inset *inside the row* — text lines up with every other screen while the
    divider runs edge to edge. `app/(app)/(tabs)/piece.tsx` is the reference.
- **Layout** — flow plus a max width. No column grid.

**Proximity settles every spacing argument: the gap between groups is visibly larger than
the gap within one** — the smallest step inside a row, one step up between related rows, a
large step between sections. A screen using one value for two of those has lost its
structure.

A scroll view with a FAB over it pays the scroll-tail padding. **A FAB overlapping the last
item is a defect.**

## Shape

- **Radius** — four steps, chosen by what the thing is, not by taste: the smallest for the
  progress bar and hairline wells, one step up for chips, the card step for cards, sheets
  and dialogs, and full for buttons, the FAB and the search field. Nothing between steps.
- **Borders** — one weight, `outlineVariant`, and only where elevation cannot do the job.
- **Texture** — none. No grain, noise, gradient or pattern. Stated flatly so adding one
  later is not a judgement call.

## Components

The canonical implementation owns the styling. Extend it. **Restyling a copy is a defect.**

| Component | Canonical file |
|---|---|
| Page frame | [`components/ui/ScreenContent.tsx`](../components/ui/ScreenContent.tsx) |
| Form frame | [`components/ui/FormScaffold.tsx`](../components/ui/FormScaffold.tsx) |
| Lifecycle chip | [`components/ui/StateChip.tsx`](../components/ui/StateChip.tsx) |
| Piece card | [`components/ui/card-style.ts`](../components/ui/card-style.ts) |
| Progress | [`components/ui/PieceProgressBar.tsx`](../components/ui/PieceProgressBar.tsx) |
| Loading / empty | [`components/ui/CenteredScreen.tsx`](../components/ui/CenteredScreen.tsx) |
| Errors | [`components/ui/ErrorSnackbar.tsx`](../components/ui/ErrorSnackbar.tsx) |
| Text field | [`components/ui/FormTextField.tsx`](../components/ui/FormTextField.tsx) |
| Row overflow | [`components/ui/RowActionsMenu.tsx`](../components/ui/RowActionsMenu.tsx) |

- **Reach for a `react-native-paper` component first.** A style prop built from the token
  file is the second choice. There is no third.
- **Buttons** — filled for the one primary action, outlined for a real second action, text
  for anything tertiary, and Paper's error colour for destructive. One filled button per
  screen.
- **Control height** — one shared minimum for anything pressable, and Paper does not give it
  for free: its buttons, icon buttons and app-bar actions render below it, dialog actions
  lower still. Pass `contentStyle` to a Paper button, set it explicitly on a custom
  pressable. A chip with an `onPress` is a control and owes the minimum; a chip without one
  is a label and does not.
- **Forms** — Paper's `TextInput` with its floating label, helper text below the field,
  errors below in the error role. Required is the norm here, so mark the optional ones.
- **Focus ring** — in the accent, and it has to clear both schemes: the accent that reads on
  a light card is not automatically visible on a dark one.
- **Icons** — **MaterialCommunityIcons only**, via Paper's `icon="…"` prop wherever a Paper
  component takes one. It is what Paper resolves to already and the only set carrying this
  app's domain glyphs. A second set is as visible as a second typeface and gets noticed
  less; the direct `MaterialIcons` imports in the tree are drift, not precedent.
- **Empty states** — say what the screen is for and offer the action that fills it. "No
  pieces yet" on its own is not an empty state. Text and one icon; never an illustration.
- **Charts** — none, and the anti-references say why. When #24 lands, it inherits the
  lifecycle hues and the status roles, not a new palette.

## Motion

Functional. Paper's defaults and almost nothing else, on transform and opacity only.

**Animates:** the FAB, snackbar entry, menu and dialog transitions, the progress bar.
**Never animates:** lists, cards, chips, screen content. Nothing the user asked for animates
on entry — a suggestion card that fades in is a suggestion arriving late.

The metronome beat pulse (#39) is the one custom animation with a case, and the one that
most needs `prefers-reduced-motion`: it runs while somebody is trying to concentrate.

## Voice

- **Register** — plain, specific, active. Say the thing.
- **Capitalisation** — **sentence case throughout**: headings, buttons, labels, menu items.
  Proper nouns and document titles keep their capitals (Privacy Policy, Terms of Service),
  and so do initialisms (BPM).
- **Banned** — the enterprise register ("task", "item", "entry", "allocation") and the
  streak register (any copy that praises, scolds, or counts days missed).
- **Every recommendation answers "why this now?" in one line a student can read.** That is a
  design requirement, not copy: a suggestion card without it is incomplete.
- **Errors** say what failed and what to do next. **Offline is not an error** — this app is
  used where there is no wifi, so it is a normal state, in the warning role.
- Labels must survive translation. A width that fits the English is a bug in every other
  locale.

## Robustness

- **Breakpoints** — one, `breakpoints.compact`, and it breaks on content rather than on a
  device name. Below it: full-bleed rows, the tab bar, one column.
- **Overflow** — a title truncates to one line with an ellipsis; a chip row wraps. **The page
  never scrolls sideways**, and `e2e/craft.spec.ts` measures that on every route. A control
  with five options does not fit a phone and must not be used there.

## Do

- Answer "why this now?" before anything else on a screen.
- Let the title win. Reading order on a piece card is fixed: title, composer, state,
  progress, recency.
- Extend the canonical component. If it does not fit, change it there.
- Carry the state's name in the chip. **Colour is never the only signal.**

## Don't

- Don't add a colour literal outside the value files, or a bare number in a style prop.
- Don't use `StyleSheet.create`, and don't add a `className` — NativeWind is on its way out
  under #127, and reintroducing it anywhere is a defect regardless of how small.
- Don't ship an emoji as a glyph. `session/summary.tsx` renders `⤬ ✓ ·` as text today; those
  are icons wearing a costume.
- Don't put a second filled primary button on a screen.
- Don't nag. Not in a nudge, not in an empty state, not in a summary.

## Components people get wrong

- **`ScreenContent`** — the frame is the inset. Screens keep re-implementing `px-4` beside
  it instead of wrapping in it, which is exactly how piece detail ended up with none at all.
- **`StateChip` vs `MetaChip`** — `StateChip` carries lifecycle meaning and colour,
  `MetaChip` is a colourless tag. They share geometry so the two never look like different
  components side by side, and a tag reaching for `StateChip` steals the ladder's colour.
- **`Card.Title`** — pair it with `CARD_TITLE_STYLE`, or title and composer come out the
  same weight and the card flattens.
- **Paper buttons** — they miss the touch minimum on their own. `contentStyle`, every time.

## Verification

**Run it:** `scripts/dev-stack.sh up`, then the URL it prints last. Emulator-backed; the
fixture account is in [`.ai/config.toml`](../.ai/config.toml). The fixture holds four pieces,
two techniques and **no practice history**, so every piece reads as never practised and
anything ranking by recency is legitimately empty.

**Look at these,** both schemes, phone and desktop:

- `/overview` — the suggestion card and its reason line, the ladder in context, and whether
  the FAB clears the last card.
- `/piece` — both densities, either side of the compact breakpoint. The clearest test of
  whether the full-bleed list still lines up with the framed screens.
- `/piece/<id>/practice` — the logging form, judged as Rasmus: one hand, arm's length,
  between two run-throughs.

Anything a machine can measure belongs in `e2e/craft.spec.ts` rather than in a review.

## Known drift

The contract describes the target. What the app does not do yet, measured today:

- **Piece detail renders no inset and no max width** — composer at x=0 where the pieces list
  is at 16; the `px-4` in source never reaches the DOM. (#31)
- **The loudest lifecycle chip fails the text floor in light mode**, 4.46:1, the only pair
  that does (next worst 4.74:1). Darken the hue or lower its alpha; the ordering rule
  survives either.
- **Touch targets are below the minimum on every route.** (#113) The assertion is
  deliberately absent from `e2e/craft.spec.ts` and turns on inside that PR.
- **Five-option controls on the practice screen overflow the right edge at phone width.**
- **On desktop the search field is full-bleed while the cards below it clamp.**
- **165 `className` uses across 40 files, and `theme/tokens.ts` does not exist.** (#127)
- **Capitalisation is mixed** — roughly 75 title-case strings against 214 sentence-case.
- **Two icon sets** — four files import `MaterialIcons` directly.

None of this is fixed by this document. Each is an issue, and the gate that measures it goes
green inside the PR that pays it off, never by loosening a rule here.

## Decisions

Empty, and that is correct. An entry is added only after a rule here has been **contested** —
reverted, argued against, or broken twice — and survived anyway. Record the rule, the
argument, and why it stands. Routine choices edit the rules above instead.
