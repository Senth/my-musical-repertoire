export type PracticeTrigger =
	| "full-piece"
	| "section-panel"
	| "direct"
	| "session-coach";

export interface PiecePractice {
	id?: string;
	pieceId: string;
	date: Date;
	technicalMistakes: PracticeMistakes;
	memoryMistakes: PracticeMistakes;
	achievedBpm?: number | null;
	flaggedSectionIds?: string[] | null;
	triggeredFrom?: PracticeTrigger;
	sessionId?: string | null;
}

export interface SectionPractice {
	id?: string;
	sectionId: string;
	pieceId: string;
	date: Date;
	quality: 1 | 2 | 3 | 4 | 5;
	effort: 1 | 2 | 3 | 4 | 5;
	achievedBpm?: number | null;
	sessionId?: string | null;
	triggeredFrom?: PracticeTrigger;
}

export enum PracticeMistakes {
	none,
	few,
	some,
	many,
	everywhere,
}
