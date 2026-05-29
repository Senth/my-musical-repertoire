export type SessionEmphasis =
	| "balanced"
	| "technique-heavy"
	| "reading-heavy"
	| "repertoire-only";

export const SESSION_EMPHASES: SessionEmphasis[] = [
	"balanced",
	"technique-heavy",
	"reading-heavy",
	"repertoire-only",
];

export type BlockKind =
	| "warmup"
	| "technique"
	| "sight-reading"
	| "repertoire-learning"
	| "repertoire-stabilizing"
	| "repertoire-maintenance";

export interface PlannedBlock {
	kind: BlockKind;
	allocatedMinutes: number;
	pieceId?: string | null;
	sectionId?: string | null;
	techniqueId?: string | null;
	title?: string | null;
	subtitle?: string | null;
	score?: number | null;
	rationale?: string | null;
}

export interface SessionPlan {
	emphasis: SessionEmphasis;
	totalMinutes: number;
	blocks: PlannedBlock[];
	generatedAt: string;
}

export interface SessionInputs {
	totalMinutes: number;
	emphasis: SessionEmphasis;
	techniqueEnabled: boolean;
	sightReadingEnabled: boolean;
}

export type BlockStatus = "pending" | "in-progress" | "completed" | "skipped";

export interface BlockExecutionState {
	index: number;
	status: BlockStatus;
	elapsedSeconds: number;
	extendMinutes: number;
}

export interface ActiveSession {
	plan: SessionPlan;
	inputs: SessionInputs;
	startedAt: string;
	sessionId: string;
	currentBlockIndex: number;
	blockStates: BlockExecutionState[];
	sessionElapsedSeconds: number;
	currentBlockStartedAt?: string | null;
}
