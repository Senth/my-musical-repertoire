import type { TimeSignature } from "@/utils/time-signature";
import type { ByMode, PracticeDrill, TechniqueHandsMode } from "./practice";

export type TechniqueState = "active" | "maintenance" | "retired";

export type TechniqueType =
	| "scale"
	| "arpeggio"
	| "exercise"
	| "chord"
	| "octave"
	| "trill"
	| "other";

export const TECHNIQUE_STATES: TechniqueState[] = [
	"active",
	"maintenance",
	"retired",
];

export const TECHNIQUE_TYPES: TechniqueType[] = [
	"scale",
	"arpeggio",
	"exercise",
	"chord",
	"octave",
	"trill",
	"other",
];

export interface TechniqueItem {
	id?: string;
	userId: string;
	title: string;
	state: TechniqueState;
	type?: TechniqueType | null;
	targetTempoBpm?: number | null;
	/** The metronome signature; techniques have no override axis. */
	timeSignature?: TimeSignature | null;
	notes?: string | null;
	dateIntroduced: Date;
	lastPracticedAt?: Date | null;
	lastQuality?: 1 | 2 | 3 | 4 | 5 | null;
	lastEffort?: 1 | 2 | 3 | 4 | 5 | null;
	lastAchievedTempoBpm?: number | null;
	/** Per-mode stats, keyed by `modeKey(hands, drill)`. */
	byMode?: ByMode;
	/** Defaults to `"separate"` when absent. */
	handsMode?: TechniqueHandsMode;
	/** Defaults to `[]` when absent. */
	activeDrills?: PracticeDrill[];
}
