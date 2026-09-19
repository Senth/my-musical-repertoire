import { nextPracticeDaysSinceSpan, resetSpanCadence } from "./span-cadence";

describe("nextPracticeDaysSinceSpan", () => {
	it("increments on a new practice day", () => {
		const lastPracticed = new Date("2026-01-09T10:00:00");
		const now = new Date("2026-01-10T10:00:00");
		expect(nextPracticeDaysSinceSpan(2, lastPracticed, now)).toBe(3);
	});

	it("does not double-increment on a second save the same calendar day", () => {
		const lastPracticed = new Date("2026-01-10T09:00:00");
		const now = new Date("2026-01-10T20:00:00");
		expect(nextPracticeDaysSinceSpan(2, lastPracticed, now)).toBe(2);
	});

	it("respects the 3am cutoff: 02:00 counts as the previous day", () => {
		const lastPracticed = new Date("2026-01-09T23:00:00");
		const now = new Date("2026-01-10T02:00:00");
		expect(nextPracticeDaysSinceSpan(2, lastPracticed, now)).toBe(2);
	});

	it("increments past the cutoff once the new day truly starts", () => {
		const lastPracticed = new Date("2026-01-09T23:00:00");
		const now = new Date("2026-01-10T03:30:00");
		expect(nextPracticeDaysSinceSpan(2, lastPracticed, now)).toBe(3);
	});

	it("treats a never-practised piece as starting at 1", () => {
		const now = new Date("2026-01-10T10:00:00");
		expect(nextPracticeDaysSinceSpan(null, null, now)).toBe(1);
	});
});

describe("resetSpanCadence", () => {
	it("resets the counter to 0 and stamps lastSpanPracticedAt", () => {
		const now = new Date("2026-01-10T10:00:00");
		expect(resetSpanCadence(now)).toEqual({
			practiceDaysSinceSpan: 0,
			lastSpanPracticedAt: now,
		});
	});
});
