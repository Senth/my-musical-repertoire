import {
	clampLineMinutes,
	DEFAULT_PRESET_SEEDS,
	isLineEnabled,
	missingDefaultSeeds,
	PRESET_LINE_KEYS,
	PRESET_LINE_LIMITS,
	presetTotalMinutes,
} from "./session-preset";

const NAME_BY_KEY: Record<string, string> = {
	balanced: "Balanced",
	"reading-focused": "Reading focused",
	"technique-focused": "Technique focused",
	"repertoire-focused": "Repertoire focused",
};
const nameFor = (key: keyof typeof NAME_BY_KEY | string) => NAME_BY_KEY[key];

describe("presetTotalMinutes", () => {
	it("sums enabled lines", () => {
		expect(
			presetTotalMinutes({ warmup: 3, technique: 6, repertoireLearning: 11 }),
		).toBe(20);
	});

	it("ignores null and absent lines", () => {
		expect(
			presetTotalMinutes({ warmup: 3, sightReading: null, technique: 6 }),
		).toBe(9);
	});

	it("is zero for a preset with nothing enabled", () => {
		expect(presetTotalMinutes({})).toBe(0);
	});
});

describe("line limits", () => {
	it("covers every line key", () => {
		for (const key of PRESET_LINE_KEYS) {
			expect(PRESET_LINE_LIMITS[key]).toBeDefined();
		}
	});

	it("uses the agreed floors", () => {
		expect(PRESET_LINE_LIMITS.warmup.floor).toBe(3);
		expect(PRESET_LINE_LIMITS.sightReading.floor).toBe(5);
		expect(PRESET_LINE_LIMITS.technique.floor).toBe(5);
		expect(PRESET_LINE_LIMITS.repertoireLearning.floor).toBe(8);
		expect(PRESET_LINE_LIMITS.repertoireStabilizing.floor).toBe(5);
		expect(PRESET_LINE_LIMITS.repertoireMaintenance.floor).toBe(3);
	});

	it("keeps every floor below its max", () => {
		for (const key of PRESET_LINE_KEYS) {
			const { floor, max, step } = PRESET_LINE_LIMITS[key];
			expect(floor).toBeLessThan(max);
			expect(step).toBe(1);
		}
	});

	it("holds the canonical block order", () => {
		expect(PRESET_LINE_KEYS).toEqual([
			"warmup",
			"sightReading",
			"technique",
			"repertoireLearning",
			"repertoireStabilizing",
			"repertoireMaintenance",
		]);
	});
});

describe("clampLineMinutes", () => {
	it("lifts a value below the floor", () => {
		expect(clampLineMinutes("repertoireLearning", 2)).toBe(8);
	});

	it("caps a value above the max", () => {
		expect(clampLineMinutes("warmup", 40)).toBe(15);
	});

	it("rounds to whole minutes", () => {
		expect(clampLineMinutes("technique", 7.4)).toBe(7);
	});
});

describe("isLineEnabled", () => {
	it("treats null and absent as disabled", () => {
		expect(isLineEnabled({ warmup: null }, "warmup")).toBe(false);
		expect(isLineEnabled({}, "warmup")).toBe(false);
		expect(isLineEnabled({ warmup: 3 }, "warmup")).toBe(true);
	});
});

describe("default seeds", () => {
	it("all total 30 minutes", () => {
		for (const seed of DEFAULT_PRESET_SEEDS) {
			expect(presetTotalMinutes(seed.lines)).toBe(30);
		}
	});

	it("matches the agreed shapes", () => {
		const byKey = Object.fromEntries(
			DEFAULT_PRESET_SEEDS.map((s) => [s.key, s.lines]),
		);
		expect(byKey.balanced).toEqual({
			sightReading: 5,
			technique: 6,
			repertoireLearning: 11,
			repertoireStabilizing: 5,
			repertoireMaintenance: 3,
		});
		expect(byKey["reading-focused"]).toEqual({
			sightReading: 9,
			technique: 5,
			repertoireLearning: 10,
			repertoireStabilizing: 6,
		});
		expect(byKey["technique-focused"]).toEqual({
			warmup: 3,
			technique: 13,
			repertoireLearning: 8,
			repertoireStabilizing: 6,
		});
		expect(byKey["repertoire-focused"]).toEqual({
			warmup: 3,
			repertoireLearning: 12,
			repertoireStabilizing: 8,
			repertoireMaintenance: 7,
		});
	});

	it("is reproducible by hand — every seeded line respects its floor", () => {
		for (const seed of DEFAULT_PRESET_SEEDS) {
			for (const key of PRESET_LINE_KEYS) {
				const value = seed.lines[key];
				if (value == null) continue;
				expect(value).toBeGreaterThanOrEqual(PRESET_LINE_LIMITS[key].floor);
				expect(value).toBeLessThanOrEqual(PRESET_LINE_LIMITS[key].max);
			}
		}
	});

	it("only Balanced touches every non-warmup category", () => {
		const balanced = DEFAULT_PRESET_SEEDS.find((s) => s.key === "balanced");
		for (const key of PRESET_LINE_KEYS) {
			if (key === "warmup") continue;
			expect(balanced?.lines[key]).toBeGreaterThan(0);
		}
	});

	it("seeds a warmup only when the preset does not open on reading", () => {
		for (const seed of DEFAULT_PRESET_SEEDS) {
			const opensOnReading = seed.lines.sightReading != null;
			expect(seed.lines.warmup == null).toBe(opensOnReading);
		}
	});
});

describe("missingDefaultSeeds", () => {
	it("returns nothing when every built-in is present", () => {
		expect(missingDefaultSeeds(Object.values(NAME_BY_KEY), nameFor)).toEqual(
			[],
		);
	});

	it("returns exactly the deleted built-in", () => {
		const remaining = Object.values(NAME_BY_KEY).filter(
			(n) => n !== "Technique focused",
		);
		const missing = missingDefaultSeeds(remaining, nameFor);
		expect(missing.map((s) => s.key)).toEqual(["technique-focused"]);
	});

	it("matches by name case- and whitespace-insensitively", () => {
		expect(
			missingDefaultSeeds(["  balanced  "], nameFor).map((s) => s.key),
		).not.toContain("balanced");
	});

	it("ignores user presets that are not built-ins", () => {
		expect(missingDefaultSeeds(["Weekday quick"], nameFor)).toHaveLength(4);
	});
});
