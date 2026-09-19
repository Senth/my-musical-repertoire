import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	SPAN_PRACTICE_DAYS_TRIGGER,
	SPAN_READY_RATIO,
	SPAN_STALE_DAYS,
	type SpanSection,
} from "./span-detection";

function daysBetween(from: Date, to: Date): number {
	const msPerDay = 24 * 60 * 60 * 1000;
	return (to.getTime() - from.getTime()) / msPerDay;
}

/**
 * A never-spanned piece fires immediately; otherwise a span is due once
 * enough practice days or enough calendar days have passed since the last
 * one, whichever comes first.
 */
export function spanIsDue(piece: Piece, now: Date): boolean {
	if (piece.lastSpanPracticedAt == null) return true;
	if ((piece.practiceDaysSinceSpan ?? 0) >= SPAN_PRACTICE_DAYS_TRIGGER) {
		return true;
	}
	return daysBetween(piece.lastSpanPracticedAt, now) > SPAN_STALE_DAYS;
}

/**
 * HT only, because a span is played hands together by definition. A section
 * with no target passes automatically; one with a target but no HT bpm yet
 * fails.
 */
export function spanIsReady(piece: Piece, window: SpanSection[]): boolean {
	return window.every((section: Section) => {
		const target = section.targetBpmOverride ?? piece.targetTempoBpm;
		if (target == null) return true;
		const bpm = section.byMode?.HT?.bpm;
		if (bpm == null) return false;
		return bpm >= SPAN_READY_RATIO * target;
	});
}
