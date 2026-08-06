/**
 * Time-boxing for the two section-based repertoire lines.
 *
 * A line used to be one block, so a 20-minute learning line meant 20 minutes on
 * a single section. Returns on one learning section die at roughly 10–12
 * minutes — past that it is reps with no new information — so the lines are cut
 * into several capped blocks.
 *
 * The learning line no longer splits by a fixed share here: it picks blocks
 * greedily off one score-ranked pool and sizes each by the phase it landed on
 * (`session-planner.pickRepertoireLearningBlocks`). Only the bounds live here.
 *
 * Everything here is pure arithmetic on fractional minutes. Display rounding is
 * the caller's job, exactly as with the maintenance packing.
 */

/** Below this a block only gets you oriented before it ends. */
export const LEARNING_BLOCK_MIN = 8;
/** Returns die past ~12 minutes on one section. */
export const LEARNING_BLOCK_MAX = 12;
/** A cold pass, a repair pass and a confirming pass. Under this it is a check,
 * not a rehearsal. */
export const REVIEW_BLOCK_MIN = 6;
/** 6 core minutes plus one tempo probe or one flagged-spot repair. A section
 * that needs longer wants demoting to `learning`, not a bigger block. */
export const REVIEW_BLOCK_MAX = 9;
/** Matches the preset line floor — never violated for the 5..45 preset range. */
export const STABILIZING_BLOCK_MIN = 5;
export const STABILIZING_BLOCK_MAX = 12;

/** Float slack so exact boundaries (12/12, 1.75 <= 1.75) land the intended way. */
const EPS = 1e-9;

function blockCount(minutes: number, max: number): number {
	return Math.max(1, Math.ceil(minutes / max - EPS));
}

function evenly(total: number, count: number): number[] {
	if (count < 1) return [];
	return Array.from({ length: count }, () => total / count);
}

/**
 * Splits `allocatedMinutes` of stabilizing line into capped blocks. No review
 * share — the whole line is consolidation already. Over the 5..45 preset range
 * the even split never falls below `STABILIZING_BLOCK_MIN`, so no borrowing.
 */
export function splitStabilizingLine(allocatedMinutes: number): number[] {
	if (allocatedMinutes <= 0) return [];
	return evenly(
		allocatedMinutes,
		blockCount(allocatedMinutes, STABILIZING_BLOCK_MAX),
	);
}
