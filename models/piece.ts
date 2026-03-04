import type { PracticeMistakes } from "./practice";

export interface Piece {
	id?: string;
	userId: string;
	title: string;
	composer: string;
	lastPracticed?: Date | null;
	lastTechnicalMistakes?: PracticeMistakes;
	lastMemoryMistakes?: PracticeMistakes;
}
