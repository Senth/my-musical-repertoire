import type { Piece } from "@/models/piece";
import type { HandsMode, ModeStats } from "@/models/practice";
import { hsTarget, isHtReady, modeKey } from "./practice-modes";
import type { SpanSection } from "./span-detection";

function sectionTarget(section: SpanSection, piece: Piece): number | null {
	return section.targetBpmOverride ?? piece.targetTempoBpm ?? null;
}

interface HandRank {
	gap: number;
	quality: number;
	staleness: number;
}

function rankStats(
	stats: ModeStats | undefined,
	target: number | null,
): HandRank {
	const bpm = stats?.bpm;
	return {
		gap: bpm == null ? Number.POSITIVE_INFINITY : (target ?? bpm) - bpm,
		quality: stats?.quality ?? 6,
		staleness: stats?.lastPracticed
			? -stats.lastPracticed.getTime()
			: Number.POSITIVE_INFINITY,
	};
}

/** Positive when `a` needs work more than `b`. */
function compareRank(a: HandRank, b: HandRank): number {
	if (a.gap !== b.gap) return a.gap - b.gap;
	if (a.quality !== b.quality) return b.quality - a.quality;
	return a.staleness - b.staleness;
}

/** The hand's worst section: largest gap to that section's own target, ties
 * by lower quality then staler practice. */
function worstSectionRank(
	sections: SpanSection[],
	piece: Piece,
	hand: HandsMode,
): HandRank {
	let worst = rankStats(
		sections[0].byMode?.[modeKey(hand)],
		hsTarget(sectionTarget(sections[0], piece)),
	);
	for (const section of sections.slice(1)) {
		const rank = rankStats(
			section.byMode?.[modeKey(hand)],
			hsTarget(sectionTarget(section, piece)),
		);
		if (compareRank(rank, worst) > 0) worst = rank;
	}
	return worst;
}

/**
 * HT opens only when every section clears its own hands-separate target.
 * Otherwise the weaker of LH/RH across the span — the hand whose worst
 * section sits furthest from that section's own target. Each section's
 * readiness and rank is judged against its own target: never a synthesised
 * `byMode`, which would blur targets that differ between sections.
 */
export function spanPreselectHands(
	sections: SpanSection[],
	piece: Piece,
): HandsMode {
	const allHtReady = sections.every((section) =>
		isHtReady(section.byMode, sectionTarget(section, piece)),
	);
	if (allHtReady) return "HT";

	const lh = worstSectionRank(sections, piece, "LH");
	const rh = worstSectionRank(sections, piece, "RH");
	return compareRank(rh, lh) > 0 ? "RH" : "LH";
}

export interface SpanModeStats {
	bpm: number | null;
	quality: 1 | 2 | 3 | 4 | 5 | null;
	effort: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed: Date | null;
}

/**
 * Minimum BPM, quality and effort, and the oldest last-practised date, across
 * the sections that hold the given hand. A section missing the hand is
 * ignored; no section holding it yields all-null.
 */
export function spanModeStats(
	sections: SpanSection[],
	hand: HandsMode,
): SpanModeStats {
	const stats = sections
		.map((s) => s.byMode?.[modeKey(hand)])
		.filter((s): s is ModeStats => s != null);
	if (stats.length === 0) {
		return { bpm: null, quality: null, effort: null, lastPracticed: null };
	}
	const bpms = stats.map((s) => s.bpm).filter((b): b is number => b != null);
	const qualities = stats
		.map((s) => s.quality)
		.filter((q): q is 1 | 2 | 3 | 4 | 5 => q != null);
	const efforts = stats
		.map((s) => s.effort)
		.filter((e): e is 1 | 2 | 3 | 4 | 5 => e != null);
	const dates = stats
		.map((s) => s.lastPracticed)
		.filter((d): d is Date => d != null);
	return {
		bpm: bpms.length ? Math.min(...bpms) : null,
		quality: qualities.length
			? (Math.min(...qualities) as 1 | 2 | 3 | 4 | 5)
			: null,
		effort: efforts.length ? (Math.min(...efforts) as 1 | 2 | 3 | 4 | 5) : null,
		lastPracticed: dates.length
			? new Date(Math.min(...dates.map((d) => d.getTime())))
			: null,
	};
}
