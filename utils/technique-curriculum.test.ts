import type { ProgressionLog } from "./section-progression";
import {
	CLEAN_DAYS_SECURE,
	cleanTechniqueDays,
	nextNotStarted,
	techniqueNudge,
} from "./technique-curriculum";
import { makeTechnique } from "./test-factories";

const NOW = new Date(2026, 4, 30, 12);
const at = (day: number, hour = 12) => new Date(2026, 4, day, hour);

const log = (
	day: number,
	over: Partial<ProgressionLog> = {},
): ProgressionLog => ({
	date: at(day),
	hands: "HT",
	quality: 4,
	...over,
});

const cleanDays = (n: number, over: Partial<ProgressionLog> = {}) =>
	Array.from({ length: n }, (_, i) => log(10 + i, over));

const quality = makeTechnique({ id: "q", handsMode: "together" });
const nudge = (logs: ProgressionLog[], tech = quality) =>
	techniqueNudge(tech, [tech], logs, NOW);

describe("techniqueNudge", () => {
	it("needs three clean days", () => {
		expect(CLEAN_DAYS_SECURE).toBe(3);
		expect(nudge(cleanDays(2))).toBeNull();
		expect(nudge(cleanDays(3))).toEqual({
			cleanDays: 3,
			bpm: null,
			next: null,
		});
	});

	it("makes a day unclean when one log rates 3", () => {
		expect(nudge([...cleanDays(3), log(12, { quality: 3 })])).toBeNull();
	});

	it("ignores staccato logs", () => {
		const staccato = log(12, { quality: 1, drill: "staccato" });
		expect(nudge([...cleanDays(3), staccato])).not.toBeNull();
		expect(nudge([...cleanDays(2), log(20, { drill: "staccato" })])).toBeNull();
	});

	it("needs both hands at target for a separate-hands technique", () => {
		const tech = makeTechnique({
			id: "s",
			handsMode: "separate",
			targetTempoBpm: 100,
		});
		const both = [10, 11, 12].flatMap((d) => [
			log(d, { hands: "LH", achievedBpm: 100 }),
			log(d, { hands: "RH", achievedBpm: 104 }),
		]);
		expect(nudge(both, tech)).toEqual({ cleanDays: 3, bpm: 100, next: null });

		const slowRight = [
			...both.slice(0, 5),
			log(12, { hands: "RH", achievedBpm: 96 }),
		];
		expect(nudge(slowRight, tech)).toBeNull();
	});

	it("needs a hands-together log at target for together and both", () => {
		for (const handsMode of ["together", "both"] as const) {
			const tech = makeTechnique({ id: "t", handsMode, targetTempoBpm: 100 });
			expect(nudge(cleanDays(3, { achievedBpm: 100 }), tech)).not.toBeNull();
			expect(nudge(cleanDays(3, { achievedBpm: 99 }), tech)).toBeNull();
			expect(
				nudge(cleanDays(3, { hands: "LH", achievedBpm: 120 }), tech),
			).toBeNull();
		}
	});

	it("judges quality alone without a target", () => {
		expect(nudge(cleanDays(3, { achievedBpm: null }))).not.toBeNull();
	});

	it("ignores logs from before dateIntroduced", () => {
		const tech = makeTechnique({
			id: "r",
			handsMode: "together",
			dateIntroduced: at(11, 18),
		});
		expect(cleanTechniqueDays(tech, cleanDays(4))).toBe(2);
		expect(nudge(cleanDays(4), tech)).toBeNull();
	});

	it("stays hidden while snoozed", () => {
		const snoozed = (until: Date) =>
			nudge(cleanDays(3), { ...quality, nudgeSnoozedUntil: until });
		expect(snoozed(at(31))).toBeNull();
		expect(snoozed(at(29))).not.toBeNull();
	});

	it.each([
		"not_started",
		"maintenance",
		"retired",
	] as const)("never nudges a %s technique", (state) => {
		expect(nudge(cleanDays(3), { ...quality, state })).toBeNull();
	});

	it("names the next Not started technique", () => {
		const next = makeTechnique({ id: "n", state: "not_started" });
		expect(
			techniqueNudge(quality, [quality, next], cleanDays(3), NOW)?.next,
		).toBe(next);
	});

	it("counts logs either side of 3am as two days", () => {
		expect(
			cleanTechniqueDays(quality, [
				{ ...log(10), date: at(10, 2) },
				{ ...log(10), date: at(10, 4) },
			]),
		).toBe(2);
	});
});

describe("nextNotStarted", () => {
	it("picks the oldest Not started technique, title breaking ties", () => {
		const queued = (id: string, title: string, day: number) =>
			makeTechnique({
				id,
				title,
				state: "not_started",
				dateIntroduced: at(day),
			});
		expect(
			nextNotStarted([
				makeTechnique({ id: "a", state: "active", dateIntroduced: at(1) }),
				queued("late", "Arpeggios", 9),
				queued("b", "Scales B", 5),
				queued("a2", "Scales A", 5),
			])?.id,
		).toBe("a2");
	});

	it("returns null with nothing queued", () => {
		expect(nextNotStarted([quality])).toBeNull();
	});
});
