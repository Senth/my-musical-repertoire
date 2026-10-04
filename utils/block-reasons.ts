import type { TFunction } from "i18next";
import type { Piece } from "@/models/piece";
import type { ModeKey } from "@/models/practice";
import type { TechniqueItem } from "@/models/technique";
import { modeLabelLong } from "./mode-label";
import {
	BPM_GAP_WEIGHT,
	bpmGap,
	daysSince,
	NEEDS_WORK_WEIGHT,
	needsWorkTerm,
	type SectionCandidate,
	STATE_SCORE,
} from "./planner-scoring";
import { parseModeKey, targetForMode } from "./practice-modes";

export type ReasonKey =
	| "neverPracticed"
	| "daysSince"
	| "bpmGap"
	| "notClean"
	| "feltHard"
	| "mistakes"
	| "spanDue"
	| "spanNeverPracticed"
	| "leadsIn";

export interface BlockReason {
	key: ReasonKey;
	params: Record<string, number>;
}

const NEVER_PRACTICED: BlockReason = { key: "neverPracticed", params: {} };

/** `daysSince` floors 24-hour spans, so last night would otherwise read "0 days". */
function daysReason(key: "daysSince" | "spanDue", days: number): BlockReason {
	return { key, params: { count: Math.max(1, days) } };
}

/** Names whichever half of the needs-work term was larger; a tie is `notClean`. */
function needsWorkReason(
	quality: number | null | undefined,
	effort: number | null | undefined,
): BlockReason {
	const notClean = 5 - (quality ?? 5);
	const feltHard = (effort ?? 1) - 1;
	return { key: notClean >= feltHard ? "notClean" : "feltHard", params: {} };
}

/**
 * Mirrors `scoreSectionModes`: the reason reads the very stats the winning mode
 * was scored from, so a section drilled left hand this morning can come back for
 * the right hand this evening and still explain itself honestly.
 */
export function reasonForCandidate(
	candidate: SectionCandidate,
	now: Date,
): BlockReason {
	const modeKey = candidate.modeKey;
	const stats = modeKey ? candidate.section?.byMode?.[modeKey] : null;
	const effectiveTarget =
		candidate.section?.targetBpmOverride ?? candidate.piece.targetTempoBpm;

	const lastPracticed = stats
		? (stats.lastPracticed ?? null)
		: candidate.lastPracticed;
	const currentBpm = stats ? (stats.bpm ?? null) : candidate.currentBpm;
	const quality = stats ? (stats.quality ?? null) : candidate.lastQuality;
	const effort = stats ? (stats.effort ?? null) : candidate.lastEffort;
	const target =
		stats && modeKey
			? targetForMode(parseModeKey(modeKey).hands, effectiveTarget ?? null)
			: effectiveTarget;

	if (!lastPracticed) return NEVER_PRACTICED;
	const days = daysSince(lastPracticed, now);

	// Mirrors the three terms of `scoreSectionCandidate`: whichever contributed
	// most is the honest answer to "why this passage".
	const state = candidate.state;
	const gap = bpmGap(target, currentBpm);
	const daysTerm = STATE_SCORE[state] * days;
	const bpmTerm = BPM_GAP_WEIGHT[state] * gap;
	const workTerm = NEEDS_WORK_WEIGHT[state] * needsWorkTerm(quality, effort);

	if (workTerm > daysTerm && workTerm >= bpmTerm) {
		return needsWorkReason(quality, effort);
	}
	if (bpmTerm > daysTerm) return { key: "bpmGap", params: { gap } };
	return daysReason("daysSince", days);
}

export function reasonForMaintenancePiece(
	piece: Piece,
	now: Date,
): BlockReason {
	if (!piece.lastPracticed) return NEVER_PRACTICED;
	const stateWeight = piece.state === "performance" ? 3 : 1;
	const days = daysSince(piece.lastPracticed, now);
	const mistakesTerm =
		2 * ((piece.lastTechnicalMistakes ?? 0) + (piece.lastMemoryMistakes ?? 0));
	if (mistakesTerm > stateWeight * days) return { key: "mistakes", params: {} };
	return daysReason("daysSince", days);
}

/**
 * Mirrors `scoreTechniqueModes`: `modeKey` is the mode that won the score, and
 * its stats are what the reason reads. `null` falls back to the item fields.
 */
export function reasonForTechnique(
	tech: TechniqueItem,
	modeKey: ModeKey | null,
	now: Date,
): BlockReason {
	const stats = modeKey ? tech.byMode?.[modeKey] : null;
	const lastPracticed = stats
		? (stats.lastPracticed ?? null)
		: (tech.lastPracticedAt ?? null);
	const quality = stats ? stats.quality : tech.lastQuality;
	const effort = stats ? stats.effort : tech.lastEffort;

	if (!lastPracticed) return NEVER_PRACTICED;
	const stateScore = tech.state === "active" ? 10 : 2;
	const days = daysSince(lastPracticed, now);
	const bonus = 2 * ((effort ?? 1) - 1 + (5 - (quality ?? 5)));
	if (bonus > stateScore * days) return needsWorkReason(quality, effort);
	return daysReason("daysSince", days);
}

export function reasonForSpan(piece: Piece, now: Date): BlockReason {
	const last = piece.lastSpanPracticedAt ?? null;
	if (last == null) return { key: "spanNeverPracticed", params: {} };
	return daysReason("spanDue", daysSince(last, now));
}

export function reasonText(
	reason: BlockReason,
	modeKey: ModeKey | null,
	t: TFunction,
): string {
	const text = t(`reason.${reason.key}`, reason.params);
	if (!modeKey) return text;
	return t("reason.withMode", {
		mode: modeLabelLong(modeKey, t),
		reason: text,
	});
}
