import { PIECE_STATES, type PieceState } from "@/models/piece";
import { SECTION_PHASES } from "@/models/section";
import { TECHNIQUE_STATES } from "@/models/technique";
import {
	pieceStateVisual,
	sectionPhaseVisual,
	techniqueStateVisual,
	withAlpha,
} from "./state-colors";

/** Most attention-worthy first. `maintenance` sits below the states still being built. */
const IMPORTANCE: PieceState[] = [
	"performance",
	"learning",
	"stabilizing",
	"maintenance",
	"on_hold",
	"shelved",
];

describe("piece state visuals", () => {
	it.each([true, false])("covers every state (dark=%s)", (dark) => {
		for (const state of PIECE_STATES) {
			const v = pieceStateVisual(state, dark);
			expect(v.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
			expect(v.tint).toBeGreaterThanOrEqual(0);
		}
	});

	it.each([
		true,
		false,
	])("tints get weaker down the importance ladder (dark=%s)", (dark) => {
		const tints = IMPORTANCE.map((s) => pieceStateVisual(s, dark).tint);
		for (let i = 1; i < tints.length; i++) {
			expect(tints[i]).toBeLessThan(tints[i - 1]);
		}
	});

	it("gives shelved no fill, so it recedes furthest", () => {
		expect(pieceStateVisual("shelved", false).tint).toBe(0);
		expect(pieceStateVisual("shelved", false).outlined).toBe(true);
	});

	it("uses more alpha on dark surfaces to read as the same amount of colour", () => {
		for (const state of PIECE_STATES) {
			const light = pieceStateVisual(state, false);
			const dark = pieceStateVisual(state, true);
			if (light.tint === 0) continue;
			expect(dark.tint).toBeGreaterThan(light.tint);
		}
	});

	it("gives every state its own hue, so colour alone identifies it", () => {
		const accents = PIECE_STATES.map((s) => pieceStateVisual(s, false).accent);
		expect(new Set(accents).size).toBe(PIECE_STATES.length);
	});
});

describe("technique state and section phase visuals", () => {
	it.each([true, false])("covers every technique state (dark=%s)", (dark) => {
		for (const state of TECHNIQUE_STATES) {
			expect(techniqueStateVisual(state, dark).accent).toMatch(/^#/);
		}
	});

	it.each([true, false])("covers every section phase (dark=%s)", (dark) => {
		for (const phase of SECTION_PHASES) {
			expect(sectionPhaseVisual(phase, dark).accent).toMatch(/^#/);
		}
	});

	it("keeps shared meanings on a shared hue", () => {
		// A section in maintenance and a piece in maintenance must look alike.
		expect(sectionPhaseVisual("maintenance", false).accent).toBe(
			pieceStateVisual("maintenance", false).accent,
		);
		expect(sectionPhaseVisual("learning", false).accent).toBe(
			pieceStateVisual("learning", false).accent,
		);
		expect(techniqueStateVisual("maintenance", false).accent).toBe(
			pieceStateVisual("maintenance", false).accent,
		);
	});

	it("retires techniques the way pieces are shelved", () => {
		expect(techniqueStateVisual("retired", false).outlined).toBe(true);
		expect(techniqueStateVisual("retired", false).tint).toBe(0);
	});
});

describe("withAlpha", () => {
	it("converts hex to rgba", () => {
		expect(withAlpha("#8A5300", 0.18)).toBe("rgba(138, 83, 0, 0.18)");
		expect(withAlpha("#FFFFFF", 1)).toBe("rgba(255, 255, 255, 1)");
		expect(withAlpha("#000000", 0)).toBe("rgba(0, 0, 0, 0)");
	});
});
