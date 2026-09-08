import {
	allocationTotalMinutes,
	EMPTY_ALLOCATION,
	planPresetName,
} from "./session";

const plan = {
	blocks: [],
	totalMinutes: 45,
	generatedAt: "2026-01-01T00:00:00Z",
};

describe("allocationTotalMinutes", () => {
	it("sums every block kind", () => {
		expect(
			allocationTotalMinutes({
				warmup: 5,
				sightReading: 10,
				technique: 15,
				repertoireLearning: 20,
				repertoireStabilizing: 25,
				repertoireMaintenance: 30,
			}),
		).toBe(105);
	});

	it("is 0 for the empty allocation", () => {
		expect(EMPTY_ALLOCATION).toEqual({
			warmup: 0,
			sightReading: 0,
			technique: 0,
			repertoireLearning: 0,
			repertoireStabilizing: 0,
			repertoireMaintenance: 0,
		});
		expect(allocationTotalMinutes(EMPTY_ALLOCATION)).toBe(0);
	});
});

describe("planPresetName", () => {
	it("returns the plan's preset name", () => {
		expect(
			planPresetName({ ...plan, presetName: "Deep work" }, "Session"),
		).toBe("Deep work");
	});

	it("trims surrounding whitespace", () => {
		expect(
			planPresetName({ ...plan, presetName: "  Deep work  " }, "Session"),
		).toBe("Deep work");
	});

	it("falls back when the name is missing, empty or blank", () => {
		expect(planPresetName(plan, "Session")).toBe("Session");
		expect(planPresetName({ ...plan, presetName: "" }, "Session")).toBe(
			"Session",
		);
		expect(planPresetName({ ...plan, presetName: "   " }, "Session")).toBe(
			"Session",
		);
	});
});
