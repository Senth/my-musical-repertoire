import type { BlockExecutionState, PlannedBlock } from "@/models/session";

export type CoachSegmentState =
	| "pending"
	| "on-time"
	| "over-run"
	| "finished-early"
	| "skipped";

export interface CoachSegment {
	/** Stable, positional identity: a segment IS its block's slot in the session. */
	id: string;
	state: CoachSegmentState;
	/** The segment's weight: the block's real length in minutes. */
	minutes: number;
	/** Teal fill 0..1 against the block's own allocation. */
	fill: number;
	/**
	 * Amber over-run 0..1, measured against the same allocation and drawn from
	 * the segment's left edge; the segment itself never widens.
	 */
	over: number;
}

/** A completed block with more than this left keeps a visible grey tail. */
const EARLY_TAIL_SECONDS = 30;

/**
 * One descriptor per planned block, from the blocks, their execution states
 * and the live elapsed time of the block on screen. The segment's real length
 * is the allocation plus any `+2 min` extension already taken.
 */
export function coachSegments(
	blocks: PlannedBlock[],
	states: BlockExecutionState[],
	activeElapsedSeconds: number,
): CoachSegment[] {
	return blocks.map((block, i) => {
		const state = states[i];
		const minutes = block.allocatedMinutes + (state?.extendMinutes ?? 0);
		const total = Math.max(1, minutes * 60);
		const status = state?.status ?? "pending";
		const elapsed =
			status === "in-progress"
				? activeElapsedSeconds
				: (state?.elapsedSeconds ?? 0);
		const fill = Math.min(1, Math.max(0, elapsed / total));

		if (status === "skipped") {
			return { id: `block-${i}`, state: "skipped", minutes, fill: 0, over: 0 };
		}
		if (status === "pending") {
			return { id: `block-${i}`, state: "pending", minutes, fill: 0, over: 0 };
		}
		if (elapsed > total) {
			return {
				id: `block-${i}`,
				state: "over-run",
				minutes,
				fill: 1,
				over: Math.min(1, (elapsed - total) / total),
			};
		}
		if (status === "completed" && total - elapsed > EARLY_TAIL_SECONDS) {
			return {
				id: `block-${i}`,
				state: "finished-early",
				minutes,
				fill,
				over: 0,
			};
		}
		return { id: `block-${i}`, state: "on-time", minutes, fill, over: 0 };
	});
}
