import type { TFunction } from "i18next";
import { PracticeMistakes } from "@/models/practice";
import {
	filterHistoryEntries,
	formatHistoryDay,
	groupHistoryLogs,
	type HistoryStream,
	historyDayKey,
	mergeHistoryPage,
	normalizeHistoryLog,
	PAGE_SIZE,
	scoreSteps,
} from "@/utils/practice-history";
import { RUN_THROUGH_LOG_SOURCE } from "@/utils/run-through-credit";

const sectionScope = { type: "section", pieceId: "p", sectionId: "s" } as const;
const techniqueScope = { type: "technique", techniqueId: "t" } as const;
const pieceScope = { type: "piece", pieceId: "p" } as const;
const log = (id: string, time: number, data: Record<string, unknown> = {}) =>
	normalizeHistoryLog(
		{ id, data: { date: { toDate: () => new Date(time) }, ...data } },
		"section",
	);
const t = ((key: string) => key) as TFunction;

describe("history entries", () => {
	it("groups three modes per save, ordered LH, RH, HT, with first non-null note", () => {
		const entries = groupHistoryLogs(sectionScope, [
			log("ht", 20, { hands: "HT" }),
			log("rh", 20, { hands: "RH", quality: 4, note: "slow thumb" }),
			log("lh", 20, { hands: "LH", effort: 2, note: "later note" }),
			log("old", 10),
		]);
		expect(entries).toHaveLength(2);
		expect(entries[0]).toMatchObject({
			kind: "section",
			scope: sectionScope,
			date: new Date(20),
			note: "slow thumb",
			modes: [
				{ hands: "LH", effort: 2 },
				{ hands: "RH", quality: 4 },
				{ hands: "HT" },
			],
		});
		expect(entries[0].modes.map((mode) => mode.key)).toEqual([
			"LH",
			"RH",
			"HT",
		]);
	});

	it("keeps parents separate even when dates match", () => {
		const a = groupHistoryLogs(sectionScope, [log("a", 20)])[0];
		const b = groupHistoryLogs({ ...sectionScope, sectionId: "other" }, [
			log("b", 20),
		])[0];
		expect(a.id).not.toBe(b.id);
	});

	it("hides credit in all, shows it only under its section, and isolates run-throughs", () => {
		const entries = [
			...groupHistoryLogs(pieceScope, [
				normalizeHistoryLog(
					{
						id: "run",
						data: {
							date: new Date(30),
							technicalMistakes: PracticeMistakes.few,
							memoryMistakes: PracticeMistakes.none,
							achievedBpm: 120,
							flaggedSectionIds: ["s"],
						},
					},
					"piece",
				),
			]),
			...groupHistoryLogs(sectionScope, [
				log("credited", 30, { source: RUN_THROUGH_LOG_SOURCE }),
				log("practice", 20),
			]),
		];
		expect(entries[0]).toMatchObject({
			kind: "run-through",
			flaggedSectionIds: ["s"],
			modes: [{ technicalMistakes: PracticeMistakes.few, achievedBpm: 120 }],
		});
		expect(
			filterHistoryEntries(entries, "all").map((entry) => entry.kind),
		).toEqual(["run-through", "section"]);
		expect(
			filterHistoryEntries(entries, "run-throughs").map((entry) => entry.kind),
		).toEqual(["run-through"]);
		expect(
			filterHistoryEntries(entries, "section:s").map((entry) => entry.kind),
		).toEqual(["credited", "section"]);
		expect(filterHistoryEntries(entries, "section:other")).toEqual([]);
	});

	it("places plain technique modes first, followed by ordered drill groups", () => {
		const entries = groupHistoryLogs(techniqueScope, [
			log("drill-ht", 20, { hands: "HT", drill: "staccato" }),
			log("rh", 20, { hands: "RH" }),
			log("drill-rh", 20, { hands: "RH", drill: "staccato" }),
			log("ht", 20),
			log("drill-lh", 20, { hands: "LH", drill: "staccato" }),
			log("lh", 20, { hands: "LH" }),
		]);
		expect(entries).toHaveLength(1);
		expect(entries[0].kind).toBe("technique");
		expect(entries[0].modes.map((mode) => mode.key)).toEqual([
			"LH",
			"RH",
			"HT",
		]);
		expect(entries[0].drillGroups).toMatchObject([
			{
				drill: "staccato",
				modes: [
					{ key: "LH.staccato" },
					{ key: "RH.staccato" },
					{ key: "HT.staccato" },
				],
			},
		]);
	});

	it("reads legacy missing hands as HT and keeps an empty-string note", () => {
		const entry = groupHistoryLogs(sectionScope, [
			log("legacy", 20, { note: "" }),
			log("lh", 20, { hands: "LH", note: "second" }),
		])[0];
		expect(entry.modes[1]).toMatchObject({
			key: "HT",
			hands: "HT",
			drill: null,
			quality: null,
		});
		expect(entry.note).toBe("");
	});
});

describe("history pagination", () => {
	it("merges three streams newest first and ignores exhausted streams", () => {
		const streams: HistoryStream[] = [
			{
				scope: sectionScope,
				logs: [log("a", 60), log("b", 30)],
				hasMore: false,
			},
			{
				scope: techniqueScope,
				logs: [log("c", 50), log("d", 20)],
				hasMore: false,
			},
			{ scope: pieceScope, logs: [log("e", 40), log("f", 10)], hasMore: false },
			{
				scope: { ...sectionScope, sectionId: "empty" },
				logs: [],
				hasMore: false,
			},
		];
		const page = mergeHistoryPage(streams);
		expect(page.entries.map((entry) => entry.date.getTime())).toEqual([
			60, 50, 40, 30, 20, 10,
		]);
		expect(page.hasMore).toBe(false);
		expect(page.refill).toEqual([]);
		expect(page.streams.every((stream) => stream.logs.length === 0)).toBe(true);
		expect(streams[0].logs).toHaveLength(2);
	});

	it("emits at most 30 complete entries and resumes with leftovers", () => {
		const logs = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
			log(`${i}`, 100 - i),
		);
		const first = mergeHistoryPage([
			{ scope: sectionScope, logs, hasMore: false },
		]);
		expect(first.entries).toHaveLength(PAGE_SIZE);
		expect(first.hasMore).toBe(true);
		const second = mergeHistoryPage(first.streams);
		expect(second.entries.map((entry) => entry.date.getTime())).toEqual([
			70, 69,
		]);
		expect(second.hasMore).toBe(false);
	});

	it("holds oldest date from a full fetch until next fetch completes its save", () => {
		const fetched = Array.from({ length: PAGE_SIZE - 1 }, (_, i) =>
			log(`new-${i}`, 100 - i),
		);
		fetched.push(log("boundary-lh", 50, { hands: "LH" }));
		const first = mergeHistoryPage([
			{ scope: sectionScope, logs: fetched, hasMore: true },
		]);
		expect(first.entries).toHaveLength(29);
		expect(first.refill).toEqual([0]);
		expect(first.streams[0].logs.map((item) => item.id)).toEqual([
			"boundary-lh",
		]);
		const second = mergeHistoryPage([
			{
				...first.streams[0],
				hasMore: false,
				logs: [
					...first.streams[0].logs,
					log("boundary-rh", 50, { hands: "RH" }),
					log("boundary-ht", 50, { hands: "HT" }),
					log("older", 40),
				],
			},
		]);
		expect(second.entries).toHaveLength(2);
		expect(second.entries[0].modes.map((mode) => mode.key)).toEqual([
			"LH",
			"RH",
			"HT",
		]);
	});

	it("stops before another stream can overtake an unbuffered stream", () => {
		const page = mergeHistoryPage([
			{
				scope: sectionScope,
				logs: [log("new", 100), log("held", 80)],
				hasMore: true,
			},
			{
				scope: techniqueScope,
				logs: [log("other", 90), log("older", 70)],
				hasMore: false,
			},
		]);
		expect(page.entries.map((entry) => entry.date.getTime())).toEqual([100]);
		expect(page.refill).toEqual([0]);
		expect(page.streams[1].logs).toHaveLength(2);
	});

	it("holds a save spanning several full fetches, including an unknown empty stream", () => {
		const logs = Array.from({ length: PAGE_SIZE * 2 }, (_, i) =>
			log(`${i}`, 50),
		);
		const held = mergeHistoryPage([
			{ scope: sectionScope, logs, hasMore: true },
		]);
		expect(held.entries).toEqual([]);
		expect(held.refill).toEqual([0]);
		expect(
			mergeHistoryPage([{ ...held.streams[0], hasMore: false }]).entries[0]
				.modes,
		).toHaveLength(60);
		const empty = mergeHistoryPage([
			{ scope: sectionScope, logs: [], hasMore: true },
			{ scope: techniqueScope, logs: [log("a", 100)], hasMore: false },
		]);
		expect(empty.entries).toEqual([]);
		expect(empty.refill).toEqual([0]);
		expect(empty.hasMore).toBe(true);
	});

	it("keeps simultaneous saves in different streams and handles no streams", () => {
		const page = mergeHistoryPage([
			{ scope: sectionScope, logs: [log("a", 10)], hasMore: false },
			{ scope: techniqueScope, logs: [log("b", 10)], hasMore: false },
		]);
		expect(page.entries).toHaveLength(2);
		expect(mergeHistoryPage([])).toEqual({
			entries: [],
			streams: [],
			refill: [],
			hasMore: false,
		});
	});
});

describe("history scores and days", () => {
	it("flips mistakes, preserves quality and effort, and leaves missing ratings empty", () => {
		expect(
			[
				PracticeMistakes.none,
				PracticeMistakes.few,
				PracticeMistakes.some,
				PracticeMistakes.many,
				PracticeMistakes.everywhere,
			].map((value) => scoreSteps(value, "mistakes")),
		).toEqual([5, 4, 3, 2, 1]);
		for (const metric of ["quality", "effort"] as const) {
			expect([1, 2, 3, 4, 5].map((value) => scoreSteps(value, metric))).toEqual(
				[1, 2, 3, 4, 5],
			);
		}
		expect(scoreSteps(null, "quality")).toBeNull();
		expect(scoreSteps(undefined, "mistakes")).toBeNull();
	});

	it("uses 3am boundary for day keys, Today and Yesterday", () => {
		const now = new Date(2026, 4, 15, 2);
		expect(historyDayKey(now)).toBe("2026-05-14");
		expect(formatHistoryDay(new Date(2026, 4, 14, 23), t, "en-US", now)).toBe(
			"common.today",
		);
		expect(formatHistoryDay(new Date(2026, 4, 14, 2), t, "en-US", now)).toBe(
			"common.yesterday",
		);
		expect(
			formatHistoryDay(
				new Date(2026, 4, 15, 3),
				t,
				"en-US",
				new Date(2026, 4, 15, 4),
			),
		).toBe("common.today");
		expect(
			formatHistoryDay(
				new Date(2026, 4, 15, 2),
				t,
				"en-US",
				new Date(2026, 4, 15, 4),
			),
		).toBe("common.yesterday");
	});

	it("formats practice day in active locale and adds year only outside current year", () => {
		const now = new Date(2026, 4, 15, 12);
		const date = new Date(2026, 4, 10, 2);
		for (const locale of ["en-US", "sv-SE"]) {
			expect(formatHistoryDay(date, t, locale, now)).toBe(
				new Intl.DateTimeFormat(locale, {
					weekday: "short",
					day: "numeric",
					month: "short",
				}).format(new Date(2026, 4, 9, 3)),
			);
			expect(formatHistoryDay(new Date(2025, 4, 10, 12), t, locale, now)).toBe(
				new Intl.DateTimeFormat(locale, {
					weekday: "short",
					day: "numeric",
					month: "short",
					year: "numeric",
				}).format(new Date(2025, 4, 10, 3)),
			);
		}
	});
});
