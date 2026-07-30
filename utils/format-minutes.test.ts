import { displayMinutes, minutesLabelKey } from "./format-minutes";

describe("displayMinutes", () => {
	it("keeps whole minutes exact", () => {
		expect(displayMinutes(4)).toEqual({ minutes: 4, approx: false });
	});

	it("rounds fractional minutes and marks them approximate", () => {
		expect(displayMinutes(3.7)).toEqual({ minutes: 4, approx: true });
		expect(displayMinutes(2.4)).toEqual({ minutes: 2, approx: true });
	});

	it("treats float noise as exact", () => {
		expect(displayMinutes(6.000000000000001)).toEqual({
			minutes: 6,
			approx: false,
		});
	});

	it("never shows 0 min for a block that has time", () => {
		expect(displayMinutes(0.3)).toEqual({ minutes: 1, approx: true });
	});

	it("returns 0 for no time at all", () => {
		expect(displayMinutes(0)).toEqual({ minutes: 0, approx: false });
	});
});

describe("minutesLabelKey", () => {
	it("picks the tilde variant only when approximate", () => {
		expect(minutesLabelKey(false)).toBe("screen.session.block.minutes");
		expect(minutesLabelKey(true)).toBe("screen.session.block.minutesApprox");
	});
});
