import type { Piece } from "@/models/piece";
import type { ByMode } from "@/models/practice";
import type { PhaseTransition, Section, SectionPhase } from "@/models/section";
import type { ModeEntry } from "./practice-modes";
import {
	type AdvanceCriterion,
	cyclingGuardDays,
	type DemoteReason,
	effectiveTargetBpm,
	evaluateAdvance,
	evaluateDemote,
	isSuppressed,
	type ProgressionLog,
} from "./section-progression";

/**
 * Turns the criteria engine into the one thing the UI needs to know: which
 * offer to show, or which passive status line to show instead. Pure.
 *
 * See `docs/specs/section-progression-nudges.md` §3.5 and §3.6.
 */

export type PhaseOfferKind = "advance" | "demote";

export interface PhaseOffer {
	kind: PhaseOfferKind;
	fromPhase: SectionPhase;
	toPhase: SectionPhase;
	/** Hands-together tempo behind an advance offer, for the copy and the audit row. */
	htBpm: number | null;
	/** Clean HT days behind an advance offer. */
	cleanDays: number;
	/** What triggered a demote offer; null on an advance. */
	demoteReason: DemoteReason | null;
	/** Days since the last phase change when it was recent; null otherwise. */
	cyclingDays: number | null;
}

export type PhaseOfferStatus =
	| { kind: "criterion"; criterion: AdvanceCriterion }
	| { kind: "suppressed" };

export interface PhaseOfferDecision {
	offer: PhaseOffer | null;
	status: PhaseOfferStatus | null;
}

/**
 * An offer plus everything needed to resolve it — so the coach screen, which
 * outlives the block body that raised it, can write the answer on its own.
 */
export interface PendingPhaseOffer {
	offer: PhaseOffer;
	pieceId: string;
	sectionId: string;
	sectionLabel: string;
	achievedBpmAtEvent: number | null;
	qualityAtEvent: number | null;
	priorPhaseChangedAt: Date | null;
	sessionId: string | null;
}

export interface PhaseOfferInput {
	section: Section;
	piece: Piece | null | undefined;
	/** The map as it stands *after* the save — not the stale snapshot. */
	byMode: ByMode | null | undefined;
	/** Fetched log history, newest first, excluding the save in progress. */
	priorLogs: ProgressionLog[];
	/** The entries the save just wrote. */
	savedEntries: ModeEntry[];
	savedAt: Date;
	/** The section's `phaseTransitions` rows, for the suppression count. */
	transitions: PhaseTransition[];
	now: Date;
}

const NOTHING: PhaseOfferDecision = { offer: null, status: null };

/** The just-saved entries as logs, so the criteria see the current session. */
function savedAsLogs(
	savedEntries: ModeEntry[],
	savedAt: Date,
): ProgressionLog[] {
	return savedEntries.map((entry) => ({
		date: savedAt,
		hands: entry.hands,
		drill: entry.drill,
		quality: entry.quality,
		effort: entry.effort,
		achievedBpm: entry.bpm,
	}));
}

export function decidePhaseOffer({
	section,
	piece,
	byMode,
	priorLogs,
	savedEntries,
	savedAt,
	transitions,
	now,
}: PhaseOfferInput): PhaseOfferDecision {
	if (!section.id) return NOTHING;

	const logs = [...savedAsLogs(savedEntries, savedAt), ...priorLogs];
	const cyclingDays = cyclingGuardDays(section.phaseChangedAt, now);

	// Demote first: it is evidence from the session that just happened, and the
	// two can never both be met — advancing needs quality >= 4 on the newest day.
	const demote = evaluateDemote(section, savedEntries, priorLogs);
	if (demote.eligible && demote.toPhase) {
		if (isSuppressed(transitions, "demote-button", now)) {
			return { offer: null, status: { kind: "suppressed" } };
		}
		return {
			offer: {
				kind: "demote",
				fromPhase: section.phase,
				toPhase: demote.toPhase,
				htBpm: byMode?.HT?.bpm ?? null,
				cleanDays: 0,
				demoteReason: demote.reason,
				cyclingDays,
			},
			status: null,
		};
	}

	const advance = evaluateAdvance(section, piece, byMode, logs);
	if (advance.eligible && advance.toPhase) {
		if (isSuppressed(transitions, "advance-button", now)) {
			return { offer: null, status: { kind: "suppressed" } };
		}
		return {
			offer: {
				kind: "advance",
				fromPhase: section.phase,
				toPhase: advance.toPhase,
				htBpm: advance.htBpm,
				cleanDays: advance.cleanDays,
				demoteReason: null,
				cyclingDays,
			},
			status: null,
		};
	}

	// A missing target is actionable advice, not a progress report, so it shows
	// however far off the rest of the criteria are.
	if (
		advance.toPhase != null &&
		effectiveTargetBpm(section, piece) == null &&
		section.phase !== "maintenance"
	) {
		return {
			offer: null,
			status: { kind: "criterion", criterion: { kind: "no-target" } },
		};
	}

	// One criterion short is a nudge worth reading. Two or more and the section
	// is simply not close — a line that always renders becomes wallpaper.
	if (advance.failing.length === 1) {
		return {
			offer: null,
			status: { kind: "criterion", criterion: advance.failing[0] },
		};
	}

	return NOTHING;
}
