import type { ModeKey } from "@/models/practice";

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
	/**
	 * The mode that made this block worth planning — the coach preselects it so
	 * the student lands on the hand/drill that drove the pick. `null` when the
	 * block was scored from legacy fields or has no modes at all.
	 */
	modeKey?: ModeKey | null;
}

export type OmittedReason = "practiced-today" | "no-content";

export interface OmittedSlot {
	kind: BlockKind;
	reason: OmittedReason;
	redistributedMinutes: number;
}

/**
 * An eligible maintenance piece too long to ever fit its slot, offered in the
 * setup preview as an explicit opt-in — the user decides whether the extra
 * minutes are worth it. Never persisted: the choice is made fresh each session.
 */
export interface MaintenanceOptIn {
	pieceId: string;
	title: string;
	/** Composer. */
	subtitle?: string | null;
	/** Full cost of the piece, fractional. */
	costMinutes: number;
	/** Minutes the session would run past the requested total. */
	extraMinutes: number;
	/** 999 when the piece was never practiced. */
	daysSinceLastPracticed: number;
}

export interface SessionPlan {
	emphasis: SessionEmphasis;
	/** The *requested* minutes, clamped 15–90. Real length adds inflation. */
	totalMinutes: number;
	blocks: PlannedBlock[];
	generatedAt: string;
	omitted?: OmittedSlot[];
	/**
	 * Maintenance minutes beyond the maintenance budget. 0 when nothing overran.
	 * Optional so sessions stored before this field keep deserializing.
	 */
	inflationMinutes?: number;
	/** The best-scored eligible maintenance piece that cannot fit. */
	maintenanceOptIn?: MaintenanceOptIn | null;
}

export interface SessionInputs {
	totalMinutes: number;
	emphasis: SessionEmphasis;
	techniqueEnabled: boolean;
	sightReadingEnabled: boolean;
	repertoireEnabled: boolean;
}

/**
 * The category each emphasis is focused on. That category is always included
 * (its toggle is hidden in setup and forced on); the other two stay toggleable.
 * `balanced` focuses on nothing in particular, so all three remain toggleable.
 */
export type SessionFocusCategory = "technique" | "sightReading" | "repertoire";

export const FOCUS_BY_EMPHASIS: Record<
	SessionEmphasis,
	SessionFocusCategory | null
> = {
	balanced: null,
	"technique-heavy": "technique",
	"reading-heavy": "sightReading",
	"repertoire-only": "repertoire",
};

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
	/** ISO timestamp set when the user leaves the coach, cleared on resume. */
	pausedAt?: string | null;
}
