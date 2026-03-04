export interface PiecePractice {
	id?: string;
	pieceId: string;
	date: Date;
	technicalMistakes: PracticeMistakes;
	memoryMistakes: PracticeMistakes;
}

export enum PracticeMistakes {
	none,
	few,
	some,
	many,
	everywhere,
}
