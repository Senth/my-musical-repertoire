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
	notes?: string | null;
	dateIntroduced: Date;
	lastPracticedAt?: Date | null;
	lastQuality?: 1 | 2 | 3 | 4 | 5 | null;
	lastEffort?: 1 | 2 | 3 | 4 | 5 | null;
	lastAchievedTempoBpm?: number | null;
}

export interface TechniquePractice {
	id?: string;
	techniqueId: string;
	date: Date;
	quality: 1 | 2 | 3 | 4 | 5;
	effort: 1 | 2 | 3 | 4 | 5;
	achievedBpm?: number | null;
	sessionId?: string | null;
}
