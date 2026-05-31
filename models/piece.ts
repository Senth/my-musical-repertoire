import type { PracticeMistakes } from "./practice";

export type PieceState =
	| "learning"
	| "stabilizing"
	| "maintenance"
	| "performance"
	| "on_hold"
	| "shelved";

export type LearningPhase =
	| "hands_separate"
	| "hands_together_slow"
	| "hands_together_building"
	| "continuity";

export const PIECE_STATES: PieceState[] = [
	"learning",
	"stabilizing",
	"maintenance",
	"performance",
	"on_hold",
	"shelved",
];

export const LEARNING_PHASES: LearningPhase[] = [
	"hands_separate",
	"hands_together_slow",
	"hands_together_building",
	"continuity",
];

export interface Piece {
	id?: string;
	userId: string;
	title: string;
	composer: string;
	state: PieceState;
	learningPhase?: LearningPhase | null;
	targetTempoBpm?: number | null;
	difficulty?: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed?: Date | null;
	lastTechnicalMistakes?: PracticeMistakes;
	lastMemoryMistakes?: PracticeMistakes;
	lastAchievedTempoBpm?: number | null;
	sectionCount?: number;
	notes?: string | null;
	durationSeconds?: number | null; // full play-through estimate; null if unknown
}
