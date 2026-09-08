import { modeLabel, modeLabelLong } from "./mode-label";

const labels: Record<string, string> = {
	"screen.practice.modes.hands.LH": "Left hand",
	"screen.practice.modes.hands.RH": "Right hand",
	"screen.practice.modes.hands.HT": "Hands together",
	"screen.practice.modes.handsLong.LH": "Left hand",
	"screen.practice.modes.handsLong.HT": "Hands together",
	"screen.practice.modes.drill.staccato": "Staccato",
};
const t = (key: string) => labels[key] ?? key;

describe("modeLabel", () => {
	it("labels a plain hands mode", () => {
		expect(modeLabel("LH", t)).toBe("Left hand");
		expect(modeLabel("HT", t)).toBe("Hands together");
	});

	it("appends a lowercased drill", () => {
		expect(modeLabel("HT.staccato", t)).toBe("Hands together staccato");
	});
});

describe("modeLabelLong", () => {
	it("labels a plain hands mode", () => {
		expect(modeLabelLong("LH", t)).toBe("Left hand");
	});

	it("wraps a lowercased drill in parentheses", () => {
		expect(modeLabelLong("HT.staccato", t)).toBe("Hands together (staccato)");
	});
});
