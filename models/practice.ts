export type PracticeTrigger =
	| "full-piece"
	| "section-panel"
	| "direct"
	| "session-coach";

export enum PracticeMistakes {
	none,
	few,
	some,
	many,
	everywhere,
}

/** Which hands a single practice log was played with. */
export type HandsMode = "LH" | "RH" | "HT";

export const HANDS_MODES: HandsMode[] = ["LH", "RH", "HT"];

/** Which hands a technique is practised with. Drives which chips appear. */
export type TechniqueHandsMode = "together" | "separate" | "both";

export const TECHNIQUE_HANDS_MODES: TechniqueHandsMode[] = [
	"together",
	"separate",
	"both",
];

/** Drill variations. Only `staccato` is selectable for now. */
export type PracticeDrill = "staccato";

export const PRACTICE_DRILLS: PracticeDrill[] = ["staccato"];

/**
 * Composite key into a `ByMode` map. `"LH"` / `"RH"` / `"HT"` for the plain
 * (normal) drill; `"LH.staccato"` etc. when a drill is active.
 */
export type ModeKey = string;

export interface ModeStats {
	bpm?: number | null;
	quality?: 1 | 2 | 3 | 4 | 5 | null;
	effort?: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed?: Date | null;
}

/** Sparse — only modes actually practised are present. */
export type ByMode = Record<ModeKey, ModeStats>;
