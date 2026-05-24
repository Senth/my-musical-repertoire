export type SectionPhase = "learning" | "stabilizing" | "maintenance";

export const SECTION_PHASES: SectionPhase[] = [
	"learning",
	"stabilizing",
	"maintenance",
];

export interface Section {
	id?: string;
	pieceId: string;
	userId: string;
	label: string;
	order: number;
	phase: SectionPhase;
	startBar?: number | null;
	endBar?: number | null;
	currentBpm?: number | null;
	targetBpmOverride?: number | null;
	notes?: string | null;
	archived: boolean;
	createdAt?: Date | null;
	lastPracticed?: Date | null;
}
