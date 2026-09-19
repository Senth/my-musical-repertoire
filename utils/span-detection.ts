import type { Section, SectionState } from "@/models/section";

/** Longest span we ever book — three sections joined is already a long stretch. */
export const SPAN_WINDOW_MAX = 3;

/** A section that carries both bars, is not archived, and is held well enough
 * that joining it to a neighbour is a fair ask. */
export interface SpanSection extends Section {
	startBar: number;
	endBar: number;
}

const SPANNABLE_STATES: SectionState[] = ["stabilizing", "maintenance"];

/** Bar-less and archived sections are transparent: they neither join a run nor
 * break one, because they say nothing about which bars are covered. */
function isVisible(section: Section): section is SpanSection {
	return (
		!section.archived &&
		section.startBar != null &&
		section.endBar != null &&
		Number.isFinite(section.startBar) &&
		Number.isFinite(section.endBar)
	);
}

function qualifies(section: SpanSection): boolean {
	return SPANNABLE_STATES.includes(section.state);
}

/** `startBar` ascending, then `endBar` descending so a containing section is
 * always seen before the sections nested inside it. */
function bySpanOrder(a: SpanSection, b: SpanSection): number {
	return a.startBar - b.startBar || b.endBar - a.endBar;
}

/**
 * Split one piece's sections into runs of bar-contiguous, spannable sections.
 * Only runs of two or more come back — a single section is ordinary practice.
 */
export function buildSpanRuns(sections: Section[]): SpanSection[][] {
	const candidates = sections.filter(isVisible).sort(bySpanOrder);

	const runs: SpanSection[][] = [];
	let current: SpanSection[] = [];

	const close = () => {
		if (current.length >= 2) runs.push(current);
		current = [];
	};

	for (const section of candidates) {
		const prev = current[current.length - 1];

		if (!qualifies(section)) {
			close();
			continue;
		}
		if (!prev) {
			current = [section];
			continue;
		}
		// Nested adds no bars, and the section containing it already cleared the
		// same gate, so it is skipped rather than allowed to end the run.
		if (section.endBar <= prev.endBar) continue;
		if (section.startBar <= prev.endBar + 1) {
			current.push(section);
			continue;
		}
		close();
		current = [section];
	}
	close();

	return runs;
}

/** Every window of `min(run.length, SPAN_WINDOW_MAX)` consecutive sections. */
export function enumerateSpanWindows(run: SpanSection[]): SpanSection[][] {
	const size = Math.min(run.length, SPAN_WINDOW_MAX);
	if (run.length < 2) return [];

	const windows: SpanSection[][] = [];
	for (let start = 0; start + size <= run.length; start++) {
		windows.push(run.slice(start, start + size));
	}
	return windows;
}

/** Every window a piece's sections offer, runs expanded. */
export function spanWindowsFor(sections: Section[]): SpanSection[][] {
	return buildSpanRuns(sections).flatMap(enumerateSpanWindows);
}

/** A missing `lastPracticed` reads as the epoch, so a never-practised section
 * drags its window to the top. */
function averageLastPracticed(window: SpanSection[]): number {
	const total = window.reduce(
		(sum, section) => sum + (section.lastPracticed?.getTime() ?? 0),
		0,
	);
	return total / window.length;
}

/**
 * The window whose sections are on average the least recently practised. Ties
 * go to the lower `startBar`. A stale pair beating a fresher trio is the
 * intent, not a side effect.
 */
export function selectSpanWindow(
	windows: SpanSection[][],
): SpanSection[] | null {
	let best: SpanSection[] | null = null;
	let bestAverage = Number.POSITIVE_INFINITY;

	for (const window of windows) {
		const average = averageLastPracticed(window);
		if (
			best == null ||
			average < bestAverage ||
			(average === bestAverage && window[0].startBar < best[0].startBar)
		) {
			best = window;
			bestAverage = average;
		}
	}

	return best;
}
