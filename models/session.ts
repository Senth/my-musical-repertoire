import type { ModeKey } from "@/models/practice";

/**
 * Resolved minutes per block kind, handed to the planner. The planner no longer
 * decides how much; only what. A zero line is simply not scheduled.
 */
export interface SessionAllocation {
	warmup: number;
	sightReading: number;
	technique: number;
	repertoireLearning: number;
	repertoireStabilizing: number;
	repertoireMaintenance: number;
}

export const EMPTY_ALLOCATION: SessionAllocation = {
	warmup: 0,
	sightReading: 0,
	technique: 0,
	repertoireLearning: 0,
	repertoireStabilizing: 0,
	repertoireMaintenance: 0,
};

export function allocationTotalMinutes(alloc: SessionAllocation): number {
	return (
		alloc.warmup +
		alloc.sightReading +
		alloc.technique +
		alloc.repertoireLearning +
		alloc.repertoireStabilizing +
		alloc.repertoireMaintenance
	);
}

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
	/** `null` for a Custom (unsaved) session. */
	presetId?: string | null;
	/** Absent on plans stored before presets existed — see `planPresetName`. */
	presetName?: string;
	/** The *allocated* minutes. Real length adds inflation. */
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

/**
 * The preset a plan was built from. Plans persisted before presets existed
 * carry an `emphasis` string and no name — someone mid-session during an update
 * should not lose it, so they fall back to a generic label instead.
 */
export function planPresetName(plan: SessionPlan, fallback: string): string {
	return plan.presetName?.trim() || fallback;
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
	startedAt: string;
	sessionId: string;
	currentBlockIndex: number;
	blockStates: BlockExecutionState[];
	sessionElapsedSeconds: number;
	currentBlockStartedAt?: string | null;
	/** ISO timestamp set when the user leaves the coach, cleared on resume. */
	pausedAt?: string | null;
}
