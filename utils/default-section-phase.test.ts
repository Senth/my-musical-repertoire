import type { Section } from "@/models/section";
import { defaultSectionPhase } from "./default-section-phase";
import { makePiece, makeSection } from "./test-factories";

const piece = (over = {}) => makePiece({ id: "p1", ...over });

const section = (over: Partial<Section> = {}) =>
	makeSection({ id: "s1", pieceId: "p1", ...over });

describe("defaultSectionPhase", () => {
	it("defaults to learning for a learning piece with no learning sections", () => {
		expect(defaultSectionPhase(piece(), [])).toBe("learning");
		expect(
			defaultSectionPhase(piece(), [section({ phase: "stabilizing" })]),
		).toBe("learning");
	});

	it("defaults to not_started for a learning piece that already has one", () => {
		expect(defaultSectionPhase(piece(), [section({ phase: "learning" })])).toBe(
			"not_started",
		);
	});

	it("ignores archived learning sections when counting", () => {
		expect(
			defaultSectionPhase(piece(), [
				section({ phase: "learning", archived: true }),
			]),
		).toBe("learning");
	});

	it("defaults to learning for a stabilizing piece", () => {
		expect(defaultSectionPhase(piece({ state: "stabilizing" }), [])).toBe(
			"learning",
		);
	});

	it.each([
		"maintenance",
		"performance",
		"on_hold",
		"shelved",
	] as const)("defaults to stabilizing for a %s piece", (state) => {
		expect(defaultSectionPhase(piece({ state }), [])).toBe("stabilizing");
	});

	it("defaults to learning without a piece", () => {
		expect(defaultSectionPhase(null, [])).toBe("learning");
	});
});
