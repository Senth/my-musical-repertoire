import type { PieceState } from "@/models/piece";
import type { SectionPhase } from "@/models/section";
import type { TechniqueState } from "@/models/technique";

/**
 * Visual weight for lifecycle chips.
 *
 * Hue identifies the state; tint strength encodes how much attention the state
 * deserves, so the chips read as a ladder rather than six equally loud badges:
 * performance > learning > stabilizing > maintenance > on hold > shelved.
 * Everything stays low-saturation on purpose — the piece title is meant to win.
 */
export interface StateVisual {
	/** Chip text, and the card's left accent stripe. */
	accent: string;
	/** Chip background: `accent` at this alpha over the card surface. */
	tint: number;
	/** Least-important states get a hairline instead of a fill. */
	outlined?: boolean;
}

interface StateVisualPair {
	light: StateVisual;
	dark: StateVisual;
}

/** Shared hues, so a phase and a piece state that mean the same thing look the same. */
const HUE = {
	performance: { light: "#8A5300", dark: "#F0B75B" },
	learning: { light: "#6A3EA1", dark: "#D3A9F0" },
	stabilizing: { light: "#1B5E8C", dark: "#8FC6EE" },
	maintenance: { light: "#1B5E3F", dark: "#7FD1A8" },
	dormant: { light: "#49454F", dark: "#CAC4D0" },
	retired: { light: "#6E6A75", dark: "#98939E" },
} as const;

type HueName = keyof typeof HUE;

/** Dark surfaces need more alpha to read as the same amount of colour. */
const TINT: Record<string, { light: number; dark: number }> = {
	performance: { light: 0.18, dark: 0.26 },
	learning: { light: 0.13, dark: 0.2 },
	stabilizing: { light: 0.1, dark: 0.16 },
	maintenance: { light: 0.08, dark: 0.13 },
	dormant: { light: 0.07, dark: 0.11 },
	none: { light: 0, dark: 0 },
};

function visual(
	hue: HueName,
	tintKey: keyof typeof TINT,
	outlined = false,
): StateVisualPair {
	return {
		light: { accent: HUE[hue].light, tint: TINT[tintKey].light, outlined },
		dark: { accent: HUE[hue].dark, tint: TINT[tintKey].dark, outlined },
	};
}

const PIECE_STATE_VISUALS: Record<PieceState, StateVisualPair> = {
	performance: visual("performance", "performance"),
	learning: visual("learning", "learning"),
	stabilizing: visual("stabilizing", "stabilizing"),
	maintenance: visual("maintenance", "maintenance"),
	on_hold: visual("dormant", "dormant"),
	shelved: visual("retired", "none", true),
};

const TECHNIQUE_STATE_VISUALS: Record<TechniqueState, StateVisualPair> = {
	active: visual("learning", "learning"),
	maintenance: visual("maintenance", "maintenance"),
	retired: visual("retired", "none", true),
};

const SECTION_PHASE_VISUALS: Record<SectionPhase, StateVisualPair> = {
	learning: visual("learning", "learning"),
	stabilizing: visual("stabilizing", "stabilizing"),
	maintenance: visual("maintenance", "maintenance"),
};

const pick = (pair: StateVisualPair, dark: boolean) =>
	dark ? pair.dark : pair.light;

export const pieceStateVisual = (state: PieceState, dark: boolean) =>
	pick(PIECE_STATE_VISUALS[state], dark);

export const techniqueStateVisual = (state: TechniqueState, dark: boolean) =>
	pick(TECHNIQUE_STATE_VISUALS[state], dark);

export const sectionPhaseVisual = (phase: SectionPhase, dark: boolean) =>
	pick(SECTION_PHASE_VISUALS[phase], dark);

/** `#RRGGBB` -> `rgba(r, g, b, alpha)`, since RN styles take no colour-mix(). */
export function withAlpha(hex: string, alpha: number): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
