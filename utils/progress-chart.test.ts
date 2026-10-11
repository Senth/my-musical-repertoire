import { PracticeMistakes } from "@/models/practice";
import {
	accuracyLevel,
	buildSeries,
	type ChartLog,
	lineWidth,
	monthTicks,
	rangeStart,
	summarise,
	yDomain,
} from "@/utils/progress-chart";

const log = (over: Partial<ChartLog> = {}): ChartLog => ({
	date: new Date(2026, 2, 1),
	hands: "LH",
	achievedBpm: 60,
	...over,
});

describe("accuracyLevel", () => {
	it.each([
		1,
		2,
		3,
		4,
		5,
		null,
		undefined,
	] as const)("maps quality and keptGoing %s", (value) => {
		const expected =
			value == null || value >= 4 ? "clean" : value === 3 ? "slips" : "shaky";
		for (const kind of ["section", "technique", "sight-reading"] as const) {
			expect(
				accuracyLevel(log({ quality: value, keptGoing: value }), kind),
			).toBe(expected);
		}
	});
	it("uses worse mistake count in either field, including missing values", () => {
		const values = [
			PracticeMistakes.none,
			PracticeMistakes.few,
			PracticeMistakes.some,
			PracticeMistakes.many,
			PracticeMistakes.everywhere,
			null,
			undefined,
		];
		for (const technicalMistakes of values)
			for (const memoryMistakes of values) {
				const worst = Math.max(technicalMistakes ?? 0, memoryMistakes ?? 0);
				expect(
					accuracyLevel(
						log({ technicalMistakes, memoryMistakes }),
						"run-through",
					),
				).toBe(worst >= 3 ? "shaky" : worst === 2 ? "slips" : "clean");
			}
	});
});

describe("buildSeries", () => {
	it("sorts by date and hand, excludes drills and missing tempos, includes credited logs", () => {
		const logs = [
			log({ date: new Date(2026, 2, 3), quality: 1, source: "run-through" }),
			log({ hands: "RH" }),
			log({ achievedBpm: null }),
			log({ achievedBpm: undefined }),
			log({ achievedBpm: Number.NaN }),
			log({ drill: "staccato" }),
			log({ quality: 5 }),
			log({ hands: null }),
		];
		const series = buildSeries(logs, "section");
		expect(series.map(({ hands }) => hands)).toEqual(["LH", "RH", "HT"]);
		expect(series[0].points).toHaveLength(2);
		expect(series[0].points.map(({ accuracy }) => accuracy)).toEqual([
			"clean",
			"shaky",
		]);
		expect(lineWidth(series[0].points[1].accuracy)).toBe(4);
		expect(logs[0].date.getDate()).toBe(3);
	});
	it.each([
		"run-through",
		"sight-reading",
	] as const)("uses one handless series for %s", (kind) => {
		expect(buildSeries([log(), log({ hands: "RH" })], kind)[0]).toMatchObject({
			hands: null,
			points: expect.any(Array),
		});
		expect(buildSeries([log(), log({ hands: "RH" })], kind)).toHaveLength(1);
	});
	it("maps all widths and takes each segment's width from its end point", () => {
		const points = buildSeries(
			[log({ quality: 1 }), log({ quality: 3 }), log({ quality: 5 })],
			"section",
		)[0].points;
		expect(points.map(({ accuracy }) => lineWidth(accuracy))).toEqual([
			4, 2, 1,
		]);
		expect(points.slice(1).map(({ accuracy }) => lineWidth(accuracy))).toEqual([
			2, 1,
		]);
	});
});

describe("rangeStart", () => {
	it("clamps month ends and resets to local midnight without changing now", () => {
		const now = new Date(2025, 2, 31, 15, 30);
		expect(rangeStart("1m", now)).toEqual(new Date(2025, 1, 28));
		expect(rangeStart("3m", now)).toEqual(new Date(2024, 11, 31));
		expect(now.getHours()).toBe(15);
	});
	it("clamps leap day when subtracting a calendar year", () => {
		expect(rangeStart("1y", new Date(2024, 1, 29, 12))).toEqual(
			new Date(2023, 1, 28),
		);
		expect(rangeStart("1m", new Date(2024, 2, 31))).toEqual(
			new Date(2024, 1, 29),
		);
		expect(rangeStart("all", new Date())).toBeNull();
	});
});

it("pads domain strictly below and above series and target to tens", () => {
	const series = buildSeries(
		[log({ achievedBpm: 61 }), log({ achievedBpm: 80 })],
		"section",
	);
	expect(yDomain(series, 100)).toEqual([60, 110]);
	expect(yDomain(series, 40)).toEqual([30, 90]);
	expect(yDomain(buildSeries([log()], "section"))).toEqual([50, 70]);
	expect(yDomain([])).toEqual([0, 10]);
	expect(yDomain([], 100)).toEqual([90, 110]);
});

it("makes local month ticks within range with localized labels across a year boundary", () => {
	const ticks = monthTicks(
		new Date(2025, 11, 15),
		new Date(2026, 2, 1),
		"en-US",
	);
	expect(ticks.map(({ label }) => label)).toEqual(["Jan", "Feb", "Mar"]);
	expect(ticks[0].date).toEqual(new Date(2026, 0, 1));
	expect(
		monthTicks(new Date(2026, 0, 1), new Date(2026, 0, 1), "sv-SE")[0].label,
	).toBe(
		new Intl.DateTimeFormat("sv-SE", { month: "short" }).format(
			new Date(2026, 0, 1),
		),
	);
	expect(
		monthTicks(new Date(2026, 2, 1), new Date(2026, 1, 1), "en-US"),
	).toEqual([]);
});

it("summarises latest tempo, clamped gap and accuracy counts per hand", () => {
	const series = buildSeries(
		[
			log({ quality: 1 }),
			log({ quality: 3 }),
			log({ quality: null }),
			log({ quality: 5, achievedBpm: 85, date: new Date(2026, 2, 4) }),
			log({ hands: "RH", achievedBpm: 100 }),
		],
		"section",
	);
	expect(summarise(series, 90)).toEqual([
		{
			hands: "LH",
			currentBpm: 85,
			gap: 5, // invariants:allow
			counts: { shaky: 1, slips: 1, clean: 2, total: 4 },
		},
		{
			hands: "RH",
			currentBpm: 100,
			gap: 0,
			counts: { shaky: 0, slips: 0, clean: 1, total: 1 },
		},
	]);
	expect(summarise(series)[0].gap).toBeNull();
	expect(summarise([])).toEqual([]);
});
