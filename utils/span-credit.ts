import type { ByMode } from "@/models/practice";
import type { ModeEntry } from "./practice-modes";
import { deriveFromByMode } from "./practice-modes";
import type { SpanSection } from "./span-detection";

/** Marks a section log as earned across a joined span rather than in isolation. */
export const SPAN_LOG_SOURCE = "span";

/** The section-log payload for one practised mode of one section in the span. */
export interface SpanLog {
	date: Date;
	hands: ModeEntry["hands"];
	drill: null;
	quality: 1 | 2 | 3 | 4 | 5;
	effort: 1 | 2 | 3 | 4 | 5;
	achievedBpm: number | null;
	sectionIds: string[];
	seamBefore: "held" | "broken" | null;
	seamAfter: "held" | "broken" | null;
	source: typeof SPAN_LOG_SOURCE;
}

/** One section's credited byMode plus every log row it earns this save. */
export interface SpanCredit {
	sectionId: string;
	byMode: ByMode;
	derived: ReturnType<typeof deriveFromByMode>;
	logs: SpanLog[];
}

export interface SpanCreditInput {
	/** The window, in play order — the same order that becomes `sectionIds`. */
	window: SpanSection[];
	/** The modes the student rated this save, one entry per practised hand. */
	entries: ModeEntry[];
	/** One entry per join, `window.length - 1` long. `true` means the join held. */
	seamChecked: boolean[];
	now: Date;
}

/**
 * The mode's stored BPM is raise-only, matching `run-through-credit.ts`: a
 * span taken below the section's earned tempo is not evidence it slowed down.
 * Applies even across a broken seam — the notes were played at that tempo.
 */
function creditedBpm(
	previous: number | null | undefined,
	achievedBpm: number | null,
): number | null {
	if (achievedBpm == null) return previous ?? null;
	return Math.max(previous ?? 0, achievedBpm);
}

/** A section sits next to a broken seam when either its incoming or its
 * outgoing join was unticked. */
function isAdjacentToBrokenSeam(
	index: number,
	seamChecked: boolean[],
): boolean {
	const before = index > 0 ? seamChecked[index - 1] : true;
	const after = index < seamChecked.length ? seamChecked[index] : true;
	return !before || !after;
}

function seamState(held: boolean | undefined): "held" | "broken" | null {
	if (held === undefined) return null;
	return held ? "held" : "broken";
}

/**
 * Pure: window plus the entered modes plus which seams broke, yields the
 * per-section `byMode` credit, its derived fields, and the log rows.
 *
 * No advance, no demote, no state offer is decided here — those gates are
 * skipped for a span entirely, by the caller never invoking them.
 */
export function computeSpanCredit({
	window,
	entries,
	seamChecked,
	now,
}: SpanCreditInput): SpanCredit[] {
	const sectionIds = window.map((s) => s.id ?? "");

	return window.map((section, index) => {
		const withheld = isAdjacentToBrokenSeam(index, seamChecked);
		const seamBefore = index > 0 ? seamState(seamChecked[index - 1]) : null;
		const seamAfter =
			index < seamChecked.length ? seamState(seamChecked[index]) : null;

		let byMode: ByMode = { ...(section.byMode ?? {}) };
		const logs: SpanLog[] = [];

		for (const entry of entries) {
			const previous = byMode[entry.hands] ?? {};
			byMode = {
				...byMode,
				[entry.hands]: {
					bpm: creditedBpm(previous.bpm, entry.bpm),
					quality: withheld ? (previous.quality ?? null) : entry.quality,
					effort: withheld ? (previous.effort ?? null) : entry.effort,
					lastPracticed: now,
				},
			};

			logs.push({
				date: now,
				hands: entry.hands,
				drill: null,
				quality: entry.quality,
				effort: entry.effort,
				achievedBpm: entry.bpm,
				sectionIds,
				seamBefore,
				seamAfter,
				source: SPAN_LOG_SOURCE,
			});
		}

		return {
			sectionId: section.id ?? "",
			byMode,
			derived: deriveFromByMode(byMode),
			logs,
		};
	});
}
