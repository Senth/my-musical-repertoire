import type { ByMode } from "./practice";

export type SectionPhase =
	| "not_started"
	| "learning"
	| "stabilizing"
	| "maintenance";

export const SECTION_PHASES: SectionPhase[] = [
	"not_started",
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
	targetBpmOverride?: number | null;
	notes?: string | null;
	archived: boolean;
	createdAt?: Date | null;
	lastPracticed?: Date | null;
	lastQuality?: 1 | 2 | 3 | 4 | 5 | null;
	lastEffort?: 1 | 2 | 3 | 4 | 5 | null;
	/** Per-hands stats. Sections have no drill axis — keys are `LH`/`RH`/`HT`. */
	byMode?: ByMode;
	/**
	 * When the phase last moved, from any trigger. Missing on sections that
	 * predate the field — never backfilled, so it reads as null and the cycling
	 * guard stays quiet.
	 */
	phaseChangedAt?: Date | null;
}

/** What caused a phase change (or a declined offer). */
export type PhaseTransitionTrigger =
	| "advance-button"
	| "demote-button"
	| "phase-chip"
	| "run-through";

export type PhaseTransitionOutcome = "accepted" | "dismissed";

/**
 * One row of `sections/{id}/phaseTransitions`. Written on every phase change and
 * on every declined nudge — the dismissals are what say whether the advance
 * thresholds are set too high. See `docs/specs/section-phases.md`.
 */
export interface PhaseTransition {
	id?: string;
	fromPhase: SectionPhase;
	/** Equal to `fromPhase` when the outcome is `dismissed`. */
	toPhase: SectionPhase;
	trigger: PhaseTransitionTrigger;
	outcome: PhaseTransitionOutcome;
	achievedBpmAtEvent: number | null;
	qualityAtEvent: number | null;
	daysInPriorPhase: number | null;
	sessionId: string | null;
	date: Date;
}
