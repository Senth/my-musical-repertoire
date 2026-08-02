import { formatComposerLine } from "./piece-display";

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
