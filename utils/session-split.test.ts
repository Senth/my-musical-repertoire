import {
	LEARNING_BLOCK_MAX,
	LEARNING_BLOCK_MIN,
	REVIEW_BLOCK_MAX,
	REVIEW_BLOCK_MIN,
	STABILIZING_BLOCK_MAX,
	STABILIZING_BLOCK_MIN,
	splitStabilizingLine,
} from "./session-split";

function round(values: number[]): number[] {
	return values.map((v) => Math.round(v * 1e6) / 1e6);
}

describe("block bounds", () => {
	it("prices a review block apart from a learning one", () => {
		// A review ceiling of 8 would collide with the learning floor: the planner
		// would price a review block identically to new acquisition.
		expect(REVIEW_BLOCK_MAX).not.toBe(LEARNING_BLOCK_MIN);
		expect(REVIEW_BLOCK_MIN).toBeLessThan(LEARNING_BLOCK_MIN);
		expect(REVIEW_BLOCK_MIN).toBeLessThan(REVIEW_BLOCK_MAX);
		expect(LEARNING_BLOCK_MIN).toBeLessThan(LEARNING_BLOCK_MAX);
	});

	it("keeps a review block long enough to be a rehearsal", () => {
		// Cold pass + repair pass + confirming pass. 3–4 minutes is a check.
		expect(REVIEW_BLOCK_MIN).toBe(6);
		expect(REVIEW_BLOCK_MAX).toBe(9);
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
