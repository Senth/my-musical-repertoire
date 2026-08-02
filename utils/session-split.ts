/**
 * Time-boxing for the two section-based repertoire lines.
 *
 * A line used to be one block, so a 20-minute learning line meant 20 minutes on
 * a single section. Returns on one learning section die at roughly 10–12
 * minutes — past that it is reps with no new information — so the line is split
 * into several capped blocks, and a mandatory share of it is reserved for
 * reviewing the already-learned sections of the same pieces.
 *
 * Everything here is pure arithmetic on fractional minutes. Display rounding is
 * the caller's job, exactly as with the maintenance packing.
 */

/** Below this a block only gets you oriented before it ends. */
export const LEARNING_BLOCK_MIN = 8;
/** Returns die past ~12 minutes on one section. */
export const LEARNING_BLOCK_MAX = 12;
/** Share of the learning line reserved for reviewing learned sections. */
export const REVIEW_SHARE = 0.25;
/** Below this the line is a single learning block — nothing left to reserve. */
export const REVIEW_TRIGGER_MINUTES = 11;
export const REVIEW_BLOCK_MIN = 3;
export const REVIEW_BLOCK_MAX = 8;
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

export interface LearningLineSplit {
	learningMinutes: number[];
	reviewMinutes: number[];
}

/**
 * Review blocks for `reviewMinutes`, split evenly.
 *
 * Never more blocks than the learning line has — spaced repetition is about
 * frequency, not dominance. Exported because the planner re-runs this step
 * after the degradation ladder hands unusable learning minutes back to review.
 */
export function splitReviewMinutes(
	reviewMinutes: number,
	learningBlockCount: number,
): number[] {
	if (reviewMinutes <= EPS || learningBlockCount < 1) return [];
	const count = Math.min(
		blockCount(reviewMinutes, REVIEW_BLOCK_MAX),
		learningBlockCount,
	);
	return evenly(reviewMinutes, count);
}

/**
 * Fit `totalMinutes` into `count` learning blocks, capping each at
 * `LEARNING_BLOCK_MAX`. `surplus` is what the cap refused — the planner moves
 * it into the review budget. `count === 0` hands everything back.
 */
export function capLearningMinutes(
	totalMinutes: number,
	count: number,
): { minutes: number[]; surplus: number } {
	if (count < 1) return { minutes: [], surplus: totalMinutes };
	const per = Math.min(LEARNING_BLOCK_MAX, totalMinutes / count);
	return {
		minutes: Array.from({ length: count }, () => per),
		surplus: Math.max(0, totalMinutes - per * count),
	};
}

/**
 * Splits `allocatedMinutes` of learning line into learning and review blocks.
 *
 * The review share is taken off the top, then the remaining budget is cut into
 * the fewest blocks that respect the 12-minute cap. When that leaves blocks
 * below the 8-minute floor the split borrows back from review (down to the
 * 3-minute review floor) to make two real blocks possible; if it cannot, the
 * line collapses to one capped block and the surplus goes to review.
 *
 * Review minutes are therefore not monotonic in `allocatedMinutes`: 18 gives
 * 6 review minutes and 19 gives 3, because at 19 the budget can just afford two
 * legal 8-minute learning blocks, and two sections beats three review minutes.
 * That step is intended — see `docs/specs/learning-and-review-blocks.md` §4.1.
 */
export function splitLearningLine(allocatedMinutes: number): LearningLineSplit {
	if (allocatedMinutes <= 0) return { learningMinutes: [], reviewMinutes: [] };

	let review =
		allocatedMinutes < REVIEW_TRIGGER_MINUTES
			? 0
			: Math.max(REVIEW_BLOCK_MIN, allocatedMinutes * REVIEW_SHARE);
	let budget = allocatedMinutes - review;

	let count = blockCount(budget, LEARNING_BLOCK_MAX);

	if (count >= 2 && budget / count < LEARNING_BLOCK_MIN - EPS) {
		const borrow = count * LEARNING_BLOCK_MIN - budget;
		const available = review - REVIEW_BLOCK_MIN;
		if (borrow <= available + EPS) {
			budget += borrow;
			review -= borrow;
		} else {
			count = 1; // the split is impossible — one block it is
		}
	}

	if (count === 1 && budget > LEARNING_BLOCK_MAX + EPS) {
		review += budget - LEARNING_BLOCK_MAX;
		budget = LEARNING_BLOCK_MAX;
	}

	return {
		learningMinutes: evenly(budget, count),
		reviewMinutes: splitReviewMinutes(review, count),
	};
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
