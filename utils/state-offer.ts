import type { Piece } from "@/models/piece";
import type { ByMode } from "@/models/practice";
import type { Section, SectionState, StateTransition } from "@/models/section";
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
 */

export type StateOfferKind = "advance" | "demote";

export interface StateOffer {
	kind: StateOfferKind;
	fromState: SectionState;
	toState: SectionState;
	/** Hands-together tempo behind an advance offer, for the copy and the audit row. */
	htBpm: number | null;
	/** Clean HT days behind an advance offer. */
	cleanDays: number;
	/** What triggered a demote offer; null on an advance. */
	demoteReason: DemoteReason | null;
	/** Days since the last state change when it was recent; null otherwise. */
	cyclingDays: number | null;
	/** When the newest log with an incoming seam recorded it as held (#204);
	 * pre-ticks the continuity check. Null on a demote or without evidence. */
	seamHeldAt: Date | null;
}

export type StateOfferStatus =
	| { kind: "criterion"; criterion: AdvanceCriterion }
	| { kind: "suppressed" };

export interface StateOfferDecision {
	offer: StateOffer | null;
	status: StateOfferStatus | null;
}

/**
 * An offer plus everything needed to resolve it — so the coach screen, which
 * outlives the block body that raised it, can write the answer on its own.
 */
export interface PendingStateOffer {
	offer: StateOffer;
	pieceId: string;
	sectionId: string;
	sectionLabel: string;
	achievedBpmAtEvent: number | null;
	qualityAtEvent: number | null;
	priorStateChangedAt: Date | null;
	sessionId: string | null;
}

export interface StateOfferInput {
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
	transitions: StateTransition[];
	now: Date;
}

const NOTHING: StateOfferDecision = { offer: null, status: null };

/**
 * Logs arrive newest first, so the first row carrying an incoming seam is the
 * latest word on whether the join held. A `null` seam (the section led its
 * most recent span) says nothing about the join, so the scan reads past it;
 * a broken seam is the word and stops it.
 */
function newestHeldSeam(logs: ProgressionLog[]): Date | null {
	for (const log of logs) {
		if (log.seamBefore != null) {
			return log.seamBefore === "held" ? log.date : null;
		}
	}
	return null;
}

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

export function decideStateOffer({
	section,
	piece,
	byMode,
	priorLogs,
	savedEntries,
	savedAt,
	transitions,
	now,
}: StateOfferInput): StateOfferDecision {
	if (!section.id) return NOTHING;

	const logs = [...savedAsLogs(savedEntries, savedAt), ...priorLogs];
	const cyclingDays = cyclingGuardDays(section.stateChangedAt, now);

	// Demote first: it is evidence from the session that just happened, and the
	// two can never both be met — advancing needs quality >= 4 on the newest day.
	const demote = evaluateDemote(section, savedEntries, priorLogs);
	if (demote.eligible && demote.toState) {
		if (isSuppressed(transitions, "demote-button", now)) {
			return { offer: null, status: { kind: "suppressed" } };
		}
		return {
			offer: {
				kind: "demote",
				fromState: section.state,
				toState: demote.toState,
				htBpm: byMode?.HT?.bpm ?? null,
				cleanDays: 0,
				demoteReason: demote.reason,
				cyclingDays,
				seamHeldAt: null,
			},
			status: null,
		};
	}

	const advance = evaluateAdvance(section, piece, byMode, logs, savedEntries);
	if (advance.eligible && advance.toState) {
		if (isSuppressed(transitions, "advance-button", now)) {
			return { offer: null, status: { kind: "suppressed" } };
		}
		return {
			offer: {
				kind: "advance",
				fromState: section.state,
				toState: advance.toState,
				htBpm: advance.htBpm,
				cleanDays: advance.cleanDays,
				demoteReason: null,
				cyclingDays,
				seamHeldAt: newestHeldSeam(priorLogs),
			},
			status: null,
		};
	}

	// A missing target is actionable advice, not a progress report, so it shows
	// however far off the rest of the criteria are.
	if (
		advance.toState != null &&
		effectiveTargetBpm(section, piece) == null &&
		section.state !== "maintenance"
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
