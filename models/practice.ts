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
	sectionId?: string | null;
	flaggedSectionIds?: string[] | null;
	triggeredFrom?: PracticeTrigger;
}

export enum PracticeMistakes {
	none,
	few,
	some,
	many,
	everywhere,
}
