import type { Section } from "@/models/section";
import { sectionNudge } from "./add-section-nudge";
import { makePiece, makeSection } from "./test-factories";

const piece = (over = {}) =>
	makePiece({ id: "p1", state: "learning", ...over });

const section = (over: Partial<Section> & { id: string }) =>
	makeSection({ pieceId: "p1", state: "stabilizing", ...over });

describe("sectionNudge", () => {
	it("nudges a learning piece whose sections have all left learning", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0 }),
			section({ id: "s2", order: 1, state: "maintenance" }),
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
			section({ id: "s1", order: 0, state: "not_started" }),
			section({ id: "s2", order: 1, state: "not_started" }),
		]);
		expect(result).toEqual({ kind: "transition", section: expect.anything() });
		expect(result?.section.id).toBe("s1");
	});

	it("prefers the not-started suggestion over adding a section", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0, state: "learning" }),
			section({ id: "s2", order: 1, state: "not_started" }),
			section({ id: "s3", order: 2, state: "not_started" }),
		]);
		expect(result?.kind).toBe("transition");
		expect(result?.section.id).toBe("s2");
	});

	it("stays quiet with two learning sections even when more are not started", () => {
		const result = sectionNudge(piece(), [
			...Array.from({ length: 5 }, (_, order) =>
				section({ id: `stable-${order}`, order }),
			),
			section({ id: "learning-1", order: 5, state: "learning" }),
			section({ id: "learning-2", order: 6, state: "learning" }),
			section({ id: "next-1", order: 7, state: "not_started" }),
			section({ id: "next-2", order: 8, state: "not_started" }),
			section({ id: "next-3", order: 9, state: "not_started" }),
		]);
		expect(result).toBeNull();
		expect(
			sectionNudge(piece(), [
				section({ id: "s1", order: 0, state: "learning" }),
				section({ id: "s2", order: 1, state: "learning" }),
				section({ id: "s3", order: 2 }),
			]),
		).toBeNull();
	});

	it("suggests adding a section when only one remains in learning", () => {
		const result = sectionNudge(piece(), [
			section({ id: "s1", order: 0 }),
			section({ id: "s2", order: 1, state: "learning" }),
		]);
		expect(result?.kind).toBe("add");
		expect(result?.section.id).toBe("s2");
	});

	it("ignores archived sections on both counts", () => {
		expect(
			sectionNudge(piece(), [
				section({ id: "s1", order: 0 }),
				section({ id: "s2", order: 1, state: "learning", archived: true }),
			])?.section.id,
		).toBe("s1");
		expect(
			sectionNudge(piece(), [section({ id: "s1", order: 0, archived: true })]),
		).toBeNull();
		expect(
			sectionNudge(piece(), [
				section({ id: "s1", order: 0, state: "learning" }),
				section({ id: "s2", order: 1, state: "learning", archived: true }),
				section({ id: "s3", order: 2, state: "not_started" }),
			])?.kind,
		).toBe("transition");
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
			makeSection({ id: "other", pieceId: "p2", state: "stabilizing" }),
		]);
		expect(result).toBeNull();
	});

	it("stays quiet for a missing piece", () => {
		expect(sectionNudge(null, [section({ id: "s1" })])).toBeNull();
	});
});
