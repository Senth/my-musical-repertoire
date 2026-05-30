import {
	DAY_CUTOFF_HOUR,
	dayStartCutoff,
	isPracticedToday,
} from "./day-boundary";

describe("day-boundary", () => {
	describe("dayStartCutoff", () => {
		it("returns today 3am when now is after 3am", () => {
			const now = new Date(2026, 4, 15, 10, 30); // local 10:30
			const cutoff = dayStartCutoff(now);
			expect(cutoff.getFullYear()).toBe(2026);
			expect(cutoff.getMonth()).toBe(4);
			expect(cutoff.getDate()).toBe(15);
			expect(cutoff.getHours()).toBe(DAY_CUTOFF_HOUR);
			expect(cutoff.getMinutes()).toBe(0);
		});

		it("returns yesterday 3am when now is before 3am", () => {
			const now = new Date(2026, 4, 15, 1, 30); // local 01:30
			const cutoff = dayStartCutoff(now);
			expect(cutoff.getDate()).toBe(14);
			expect(cutoff.getHours()).toBe(DAY_CUTOFF_HOUR);
		});

		it("returns today 3am at exactly 3:00am", () => {
			const now = new Date(2026, 4, 15, 3, 0);
			const cutoff = dayStartCutoff(now);
			expect(cutoff.getDate()).toBe(15);
			expect(cutoff.getHours()).toBe(3);
		});

		it("handles month rollover when before 3am on the 1st", () => {
			const now = new Date(2026, 4, 1, 2, 0); // May 1, 02:00
			const cutoff = dayStartCutoff(now);
			expect(cutoff.getMonth()).toBe(3); // April
			expect(cutoff.getDate()).toBe(30);
			expect(cutoff.getHours()).toBe(3);
		});
	});

	describe("isPracticedToday", () => {
		it("returns false for null lastPracticed", () => {
			const now = new Date(2026, 4, 15, 10, 0);
			expect(isPracticedToday(null, now)).toBe(false);
			expect(isPracticedToday(undefined, now)).toBe(false);
		});

		it("returns true when practiced today after the cutoff", () => {
			const now = new Date(2026, 4, 15, 10, 0);
			const last = new Date(2026, 4, 15, 8, 0); // today 08:00
			expect(isPracticedToday(last, now)).toBe(true);
		});

		it("returns false when practiced before today's 3am", () => {
			const now = new Date(2026, 4, 15, 10, 0);
			const last = new Date(2026, 4, 15, 2, 30); // today 02:30, before cutoff
			expect(isPracticedToday(last, now)).toBe(false);
		});

		it("at 2am, practice from yesterday 11pm still counts as today", () => {
			const now = new Date(2026, 4, 15, 2, 0);
			const last = new Date(2026, 4, 14, 23, 0);
			expect(isPracticedToday(last, now)).toBe(true);
		});

		it("at 4am, practice from today 2am does NOT count as today", () => {
			const now = new Date(2026, 4, 15, 4, 0);
			const last = new Date(2026, 4, 15, 2, 0);
			expect(isPracticedToday(last, now)).toBe(false);
		});

		it("returns false when practiced before yesterday's cutoff", () => {
			const now = new Date(2026, 4, 15, 10, 0);
			const last = new Date(2026, 4, 14, 2, 0); // yesterday before its 3am cutoff
			expect(isPracticedToday(last, now)).toBe(false);
		});
	});
});
