import { tempoSliderRange } from "./tempo-slider";

describe("tempoSliderRange", () => {
	it("scales a target of 110 to a 147 ceiling", () => {
		expect(tempoSliderRange({ target: 110 })).toEqual({ min: 20, max: 147 });
	});

	it("floors the ceiling at 100 for a low target", () => {
		expect(tempoSliderRange({ target: 50 })).toEqual({ min: 20, max: 100 });
	});

	it("extends the ceiling to the current tempo when it sits above", () => {
		expect(tempoSliderRange({ target: 110, value: 180 })).toEqual({
			min: 20,
			max: 180,
		});
	});

	it("floors the ceiling at 100 with no target", () => {
		expect(tempoSliderRange({ target: null })).toEqual({ min: 20, max: 100 });
	});

	it("returns 20-240 outright for sight-reading", () => {
		expect(tempoSliderRange({ fullRange: true })).toEqual({
			min: 20,
			max: 240,
		});
	});

	it("caps the ceiling, even when extended by the current tempo", () => {
		expect(tempoSliderRange({ target: 200, value: 400 })).toEqual({
			min: 20,
			max: 240,
		});
	});

	it("extends to the current tempo with no target either", () => {
		expect(tempoSliderRange({ target: null, value: 160 })).toEqual({
			min: 20,
			max: 160,
		});
	});
});
