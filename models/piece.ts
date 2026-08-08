import type { PracticeMistakes } from "./practice";

export type PieceState =
	| "learning"
	| "stabilizing"
	| "maintenance"
	| "performance"
	| "on_hold"
	| "shelved";

export const PIECE_STATES: PieceState[] = [
	"learning",
	"stabilizing",
	"maintenance",
	"performance",
	"on_hold",
	"shelved",
];

export interface Piece {
	id?: string;
	userId: string;
	title: string;
	composer: string;
	collectionName?: string | null;
	state: PieceState;
	targetTempoBpm?: number | null;
	difficulty?: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed?: Date | null;
	lastTechnicalMistakes?: PracticeMistakes;
	lastMemoryMistakes?: PracticeMistakes;
	lastAchievedTempoBpm?: number | null;
	sectionCount?: number;
	notes?: string | null;
	durationSeconds?: number | null; // full play-through estimate; null if unknown
	/** Silences the add-next-section nudge — there is no more material to add. */
	allSectionsAdded?: boolean;
}
