import { addTap, bpmFromTaps } from "./tap-tempo";

describe("addTap", () => {
	it("starts a new phrase on the first tap", () => {
		expect(addTap([], 1000)).toEqual([1000]);
	});

	it("keeps taps within a phrase", () => {
		expect(addTap([1000, 1500, 2000], 2500)).toEqual([1000, 1500, 2000, 2500]);
	});

	it("resets after a pause", () => {
		expect(addTap([1000, 1500, 2000, 2500], 5000)).toEqual([5000]);
	});

	it("drops the oldest tap once the phrase is full", () => {
		const taps = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
		expect(addTap(taps, 5000)).toEqual([
			1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000,
		]);
	});
});

describe("bpmFromTaps", () => {
	it("needs at least four taps", () => {
		expect(bpmFromTaps([])).toBeNull();
		expect(bpmFromTaps([1000, 1500, 2000])).toBeNull();
	});

	it("computes 120 BPM from taps half a second apart", () => {
		expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
	});

	it("averages uneven intervals", () => {
		expect(bpmFromTaps([0, 400, 1100, 1500])).toBe(120);
	});
});
