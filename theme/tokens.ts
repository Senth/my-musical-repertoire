/**
 * The design scale from `docs/DESIGN.md`. Ground truth for every spacing,
 * radius, width and size in the app: style props read from here, never hold a
 * bare number. Colours are the exception — they live in `theme/index.ts` (the
 * Paper palettes) and `utils/state-colors.ts` (the lifecycle set), per role.
 */

/** 4pt grid, named xxs through xxl. Extend the scale rather than inlining a
 * number between two steps. */
export const space = {
	xxs: 2,
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

/** Radius steps: the smallest for the progress bar and hairline wells, one
 * step up for chips, the card step for cards, sheets and dialogs. */
export const radius = {
	hairline: 3,
	chip: 6,
	card: 12,
} as const;

/** Paper elevation levels as shadow depths. The level *colours* live in the
 * palettes in `theme/index.ts`. */
export const elevation = {
	level0: 0,
	level1: 1,
	level2: 2,
	level3: 3,
	level4: 4,
	level5: 5,
} as const;

/** Centred content bands. Auth screens clamp tighter than pages. */
export const contentWidth = {
	form: 448,
	page: 576,
} as const;

/** Fixed widget widths that are neither spacing nor a touch target. */
export const size = {
	md: 96,
} as const;

/** Icon glyph sizes. Today's glyphs are sized per widget on Paper's `size`
 * prop; these are the MD3 steps new code reaches for. */
export const icon = {
	sm: 16,
	md: 24,
} as const;

/** Border weights: the one hairline weight, and the card's left accent
 * stripe, which is not an outline. */
export const border = {
	hairline: 1,
	stripe: 4,
} as const;

/** Shared minimum for anything pressable. #113 enforces it across the app. */
export const touchTarget = {
	minimum: 48,
} as const;

/** The one breakpoint, MD3's compact/medium window class. Breaks on content,
 * not on a device name. */
export const breakpoints = {
	compact: 600,
} as const;

/** Type scale. `labelSmall` is the small segment/chip label size. */
export const type = {
	labelSmall: 11,
} as const;

/** Pre-JS page paint colours: the static HTML shell and the auth loading view
 * before Paper's provider mounts. Not a palette — the palettes' surfaces are
 * a step away from these by design. */
export const shell = {
	light: "#fffbfe",
	dark: "#1c1b1f",
} as const;
