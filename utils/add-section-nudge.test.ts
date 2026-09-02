import type { Section } from "@/models/section";
import { sectionNudge } from "./add-section-nudge";
import { makePiece, makeSection } from "./test-factories";

const piece = (over = {}) =>
	makePiece({ id: "p1", state: "learning", ...over });

const section = (over: Partial<Section> & { id: string }) =>
	makeSection({ pieceId: "p1", phase: "stabilizing", ...over });

describe("sectionNudge", () => {
	it("nudges a learning piece whose sections have all left learning", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0 }),
			section({ id: "s2", order: 1, phase: "maintenance" }),
		]);
		expect(result).toEqual({ kind: "add", section: expect.anything() });
		expect(result?.section.id).toBe("s2");
	});

	it("names the furthest section, not the last one in the array", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s2", order: 3 }),
			section({ id: "s1", order: 1 }),
		]);
		expect(result?.section.id).toBe("s2");
	});

	it("suggests moving the next not-started section to learning", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0, phase: "not_started" }),
			section({ id: "s2", order: 1, phase: "not_started" }),
		]);
		expect(result).toEqual({ kind: "transition", section: expect.anything() });
		expect(result?.section.id).toBe("s1");
	});

	it("prefers the not-started suggestion over adding a section", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0 }),
			section({ id: "s2", order: 1, phase: "not_started" }),
		]);
		expect(result?.kind).toBe("transition");
		expect(result?.section.id).toBe("s2");
	});

	it("stays quiet while any section is still in learning", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0 }),
			section({ id: "s2", order: 1, phase: "learning" }),
		]);
		expect(result).toBeNull();
	});

	it("ignores archived sections on both counts", () => {
		expect(
			sectionNudge(piece(), [
				section({ id: "s1", order: 0 }),
				section({ id: "s2", order: 1, phase: "learning", archived: true }),
			])?.section.id,
		).toBe("s1");
		expect(
			sectionNudge(piece(), [section({ id: "s1", order: 0, archived: true })]),
		).toBeNull();
	});

	it("stays quiet for a piece with no sections", () => {
		expect(sectionNudge(piece(), [])).toBeNull();
	});

	it.each([
		"stabilizing",
		"maintenance",
		"performance",
		"on_hold",
		"shelved",
	] as const)("stays quiet for a %s piece", (state) => {
		expect(sectionNudge(piece({ state }), [section({ id: "s1" })])).toBeNull();
	});

	it("stays quiet once the student says there are no more sections", () => {
		expect(
			sectionNudge(piece({ allSectionsAdded: true }), [section({ id: "s1" })]),
		).toBeNull();
	});

	it("ignores sections belonging to another piece", () => {
		const result = sectionNudge(piece(), [
			makeSection({ id: "other", pieceId: "p2", phase: "stabilizing" }),
		]);
		expect(result).toBeNull();
	});

	it("stays quiet for a missing piece", () => {
		expect(sectionNudge(null, [section({ id: "s1" })])).toBeNull();
	});
});
