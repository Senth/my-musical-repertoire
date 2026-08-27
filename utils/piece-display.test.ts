import type { TFunction } from "i18next";
import { formatBarRange, formatComposerLine } from "./piece-display";

const t = ((key: string, params?: Record<string, unknown>) =>
	params ? `${key}:${JSON.stringify(params)}` : key) as unknown as TFunction;

describe("formatComposerLine", () => {
	it("joins composer and collection with a middle dot", () => {
		expect(formatComposerLine("Nobuo Uematsu", "Final Fantasy VII")).toBe(
			"Nobuo Uematsu · Final Fantasy VII",
		);
	});

	it("returns the composer alone when the collection is null", () => {
		expect(formatComposerLine("Nobuo Uematsu", null)).toBe("Nobuo Uematsu");
	});

	it("returns the composer alone when the collection is missing", () => {
		expect(formatComposerLine("Nobuo Uematsu")).toBe("Nobuo Uematsu");
	});

	it("returns the composer alone when the collection is blank", () => {
		expect(formatComposerLine("Nobuo Uematsu", "   ")).toBe("Nobuo Uematsu");
	});
});

describe("formatBarRange", () => {
	it("formats a start and end bar", () => {
		expect(formatBarRange({ startBar: 33, endBar: 40 }, t)).toBe(
			'screen.pieceSections.barRange:{"start":33,"end":40}',
		);
	});

	it("formats a start-only bar", () => {
		expect(formatBarRange({ startBar: 33, endBar: null }, t)).toBe(
			'screen.pieceSections.barFrom:{"start":33}',
		);
	});

	it("returns null when there is no start bar", () => {
		expect(formatBarRange({ startBar: null, endBar: null }, t)).toBeNull();
	});
});
