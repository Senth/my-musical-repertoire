import {
	capLearningMinutes,
	LEARNING_BLOCK_MAX,
	LEARNING_BLOCK_MIN,
	REVIEW_BLOCK_MIN,
	STABILIZING_BLOCK_MAX,
	STABILIZING_BLOCK_MIN,
	splitLearningLine,
	splitReviewMinutes,
	splitStabilizingLine,
} from "./session-split";

function round(values: number[]): number[] {
	return values.map((v) => Math.round(v * 1e6) / 1e6);
}

describe("splitLearningLine", () => {
	// Every row of the table in docs/specs/learning-and-review-blocks.md §4.1.
	const table: Array<[number, number[], number[]]> = [
		[8, [8], []],
		[10, [10], []],
		[11, [8], [3]],
		[13, [9.75], [3.25]],
		[15, [11.25], [3.75]],
		[16, [12], [4]],
		[17, [12], [5]],
		[18, [12], [6]],
		[19, [8, 8], [3]],
		[20, [8, 8], [4]],
		[24, [9, 9], [6]],
		[30, [11.25, 11.25], [7.5]],
		[40, [10, 10, 10], [5, 5]],
		[45, [11.25, 11.25, 11.25], [5.625, 5.625]],
		[60, [11.25, 11.25, 11.25, 11.25], [7.5, 7.5]],
	];

	for (const [minutes, learning, review] of table) {
		it(`splits ${minutes} into ${learning.length} learning + ${review.length} review blocks`, () => {
			const split = splitLearningLine(minutes);
			expect(round(split.learningMinutes)).toEqual(learning);
			expect(round(split.reviewMinutes)).toEqual(review);
		});
	}

	it("conserves the allocated minutes exactly", () => {
		for (let minutes = 1; minutes <= 60; minutes += 0.25) {
			const split = splitLearningLine(minutes);
			const total = [...split.learningMinutes, ...split.reviewMinutes].reduce(
				(acc, m) => acc + m,
				0,
			);
			expect(total).toBeCloseTo(minutes, 9);
		}
	});

	it("never exceeds the learning block cap and never falls below the floor", () => {
		for (let minutes = 1; minutes <= 60; minutes += 0.25) {
			const { learningMinutes } = splitLearningLine(minutes);
			for (const m of learningMinutes) {
				expect(m).toBeLessThanOrEqual(LEARNING_BLOCK_MAX + 1e-9);
				if (learningMinutes.length >= 2) {
					expect(m).toBeGreaterThanOrEqual(LEARNING_BLOCK_MIN - 1e-9);
				}
			}
		}
	});

	it("never gives a review block less than the floor", () => {
		for (let minutes = 1; minutes <= 60; minutes += 0.25) {
			const { reviewMinutes } = splitLearningLine(minutes);
			const total = reviewMinutes.reduce((acc, m) => acc + m, 0);
			if (reviewMinutes.length > 0) {
				expect(total).toBeGreaterThanOrEqual(REVIEW_BLOCK_MIN - 1e-9);
			}
		}
	});

	it("never plans more review blocks than learning blocks", () => {
		for (let minutes = 1; minutes <= 60; minutes += 0.25) {
			const split = splitLearningLine(minutes);
			expect(split.reviewMinutes.length).toBeLessThanOrEqual(
				split.learningMinutes.length,
			);
		}
	});

	it("steps review minutes down from 18 to 19 — two real blocks beat 3 review minutes", () => {
		// Pinned deliberately: the non-monotonic step is the intended trade, not a
		// rounding artefact. See §4.1.
		expect(splitLearningLine(18).learningMinutes).toHaveLength(1);
		expect(splitLearningLine(18).reviewMinutes).toEqual([6]);
		expect(splitLearningLine(19).learningMinutes).toEqual([8, 8]);
		expect(splitLearningLine(19).reviewMinutes).toEqual([3]);
	});

	it("reserves nothing below the review trigger", () => {
		expect(splitLearningLine(10.99).reviewMinutes).toEqual([]);
		expect(splitLearningLine(11).reviewMinutes).toEqual([3]);
	});

	it("returns nothing for a zero or negative line", () => {
		expect(splitLearningLine(0)).toEqual({
			learningMinutes: [],
			reviewMinutes: [],
		});
		expect(splitLearningLine(-5)).toEqual({
			learningMinutes: [],
			reviewMinutes: [],
		});
	});

	it("handles the preset floor and ceiling", () => {
		expect(splitLearningLine(8).learningMinutes).toEqual([8]);
		expect(splitLearningLine(60).learningMinutes).toHaveLength(4);
	});
});

describe("splitStabilizingLine", () => {
	const table: Array<[number, number[]]> = [
		[5, [5]],
		[8, [8]],
		[12, [12]],
		[13, [6.5, 6.5]],
		[15, [7.5, 7.5]],
		[20, [10, 10]],
		[25, [25 / 3, 25 / 3, 25 / 3]],
		[45, [11.25, 11.25, 11.25, 11.25]],
	];

	for (const [minutes, blocks] of table) {
		it(`splits ${minutes} into ${blocks.length} block(s)`, () => {
			expect(round(splitStabilizingLine(minutes))).toEqual(round(blocks));
		});
	}

	it("returns nothing for a zero or negative line", () => {
		expect(splitStabilizingLine(0)).toEqual([]);
		expect(splitStabilizingLine(-3)).toEqual([]);
	});

	it("stays inside the block bounds across the preset range", () => {
		for (let minutes = STABILIZING_BLOCK_MIN; minutes <= 45; minutes += 0.25) {
			const blocks = splitStabilizingLine(minutes);
			const total = blocks.reduce((acc, m) => acc + m, 0);
			expect(total).toBeCloseTo(minutes, 9);
			for (const m of blocks) {
				expect(m).toBeLessThanOrEqual(STABILIZING_BLOCK_MAX + 1e-9);
				expect(m).toBeGreaterThanOrEqual(STABILIZING_BLOCK_MIN - 1e-9);
			}
		}
	});
});

describe("splitReviewMinutes", () => {
	it("caps the block count at the learning block count", () => {
		expect(splitReviewMinutes(20, 1)).toEqual([20]);
		expect(splitReviewMinutes(20, 2)).toEqual([10, 10]);
		expect(splitReviewMinutes(20, 5)).toEqual([20 / 3, 20 / 3, 20 / 3]);
	});

	it("returns nothing without minutes or without a learning block", () => {
		expect(splitReviewMinutes(0, 3)).toEqual([]);
		expect(splitReviewMinutes(8, 0)).toEqual([]);
	});
});

describe("capLearningMinutes", () => {
	it("caps each block and reports the surplus", () => {
		expect(capLearningMinutes(16, 1)).toEqual({ minutes: [12], surplus: 4 });
		expect(capLearningMinutes(16, 2)).toEqual({ minutes: [8, 8], surplus: 0 });
	});

	it("hands everything back when there is no block to fill", () => {
		expect(capLearningMinutes(16, 0)).toEqual({ minutes: [], surplus: 16 });
	});
});
