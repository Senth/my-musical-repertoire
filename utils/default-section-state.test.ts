import type { Section } from "@/models/section";
import { defaultSectionState } from "./default-section-state";
import { makePiece, makeSection } from "./test-factories";

const piece = (over = {}) => makePiece({ id: "p1", ...over });

const section = (over: Partial<Section> = {}) =>
	makeSection({ id: "s1", pieceId: "p1", ...over });

describe("defaultSectionState", () => {
	it("defaults to learning for a learning piece with no learning sections", () => {
		expect(defaultSectionState(piece(), [])).toBe("learning");
		expect(
			defaultSectionState(piece(), [section({ state: "stabilizing" })]),
		).toBe("learning");
	});

	it("defaults to not_started for a learning piece that already has one", () => {
		expect(defaultSectionState(piece(), [section({ state: "learning" })])).toBe(
			"not_started",
		);
	});

	it("ignores archived learning sections when counting", () => {
		expect(
			defaultSectionState(piece(), [
				section({ state: "learning", archived: true }),
			]),
		).toBe("learning");
	});

	it("defaults to learning for a stabilizing piece", () => {
		expect(defaultSectionState(piece({ state: "stabilizing" }), [])).toBe(
			"learning",
		);
	});

	it.each([
		"maintenance",
		"performance",
		"on_hold",
		"shelved",
	] as const)("defaults to stabilizing for a %s piece", (state) => {
		expect(defaultSectionState(piece({ state }), [])).toBe("stabilizing");
	});

	it("defaults to learning without a piece", () => {
		expect(defaultSectionState(null, [])).toBe("learning");
	});
});
