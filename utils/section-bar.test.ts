import { computeSectionBar } from "@/utils/section-bar";

const sections = [
	{ id: "intro", startBar: 1, endBar: 10 },
	{ id: "theme", startBar: 21, endBar: 50 },
];

describe("computeSectionBar", () => {
	it("packs proportional inclusive widths without gaps in supplied order", () => {
		expect(
			computeSectionBar({
				sections,
				played: { kind: "run-through" },
				flaggedSectionIds: [],
			}),
		).toEqual({
			segments: [
				{ sectionId: "intro", start: 0, width: 0.25, fill: 1, flagged: false },
				{
					sectionId: "theme",
					start: 0.25,
					width: 0.75,
					fill: 1,
					flagged: false,
				},
			],
		});
	});

	it.each([
		{ id: "unknown" },
		{ id: "unknown", startBar: 51 },
		{ id: "unknown", endBar: 60 },
		{ id: "unknown", startBar: null, endBar: null },
	])("uses equal widths when any input range is incomplete: %j", (unknown) => {
		const result = computeSectionBar({
			sections: [...sections, unknown],
			played: { kind: "section", sectionId: "unknown", ranges: [] },
			flaggedSectionIds: [],
		});
		expect(result?.segments.map(({ width }) => width)).toEqual([
			1 / 3,
			1 / 3,
			1 / 3,
		]);
		expect(result?.segments.map(({ fill }) => fill)).toEqual([0, 0, 1]);
		expect(result?.segments.map(({ start }) => start)).toEqual([
			0,
			1 / 3,
			2 / 3,
		]);
	});

	it("omits combination segments and fills both contained sections", () => {
		const combined = { id: "combined", startBar: 1, endBar: 35 };
		const result = computeSectionBar({
			sections: [
				combined,
				sections[0],
				{ id: "theme", startBar: 11, endBar: 35 },
			],
			played: { kind: "section", sectionId: "combined", ranges: [combined] },
			flaggedSectionIds: [],
		});
		expect(
			result?.segments.map(({ sectionId, fill }) => ({ sectionId, fill })),
		).toEqual([
			{ sectionId: "intro", fill: 1 },
			{ sectionId: "theme", fill: 1 },
		]);
		expect(result?.segments.map(({ width }) => width)).toEqual([
			10 / 35,
			25 / 35,
		]);
	});

	it("fills partial overlaps and leaves unplayed segments empty", () => {
		const result = computeSectionBar({
			sections,
			played: {
				kind: "section",
				sectionId: "theme",
				ranges: [{ startBar: 21, endBar: 35 }],
			},
			flaggedSectionIds: ["theme"],
		});
		expect(result?.segments.map(({ fill }) => fill)).toEqual([0, 0.5]);
		expect(result?.segments.every(({ flagged }) => !flagged)).toBe(true);
	});

	it("unions multiple played ranges without counting overlapping bars twice", () => {
		const result = computeSectionBar({
			sections,
			played: {
				kind: "section",
				sectionId: "intro",
				ranges: [
					{ startBar: 5, endBar: 8 },
					{ startBar: 2, endBar: 6 },
					{ startBar: 30, endBar: 32 },
				],
			},
			flaggedSectionIds: [],
		});
		expect(result?.segments.map(({ fill }) => fill)).toEqual([0.7, 0.1]);
	});

	it("fills run-throughs and flags only named segments", () => {
		const result = computeSectionBar({
			sections,
			played: { kind: "run-through" },
			flaggedSectionIds: ["theme", "missing"],
		});
		expect(
			result?.segments.map(({ fill, flagged }) => ({ fill, flagged })),
		).toEqual([
			{ fill: 1, flagged: false },
			{ fill: 1, flagged: true },
		]);
	});

	it("returns null without sections", () => {
		expect(
			computeSectionBar({
				sections: [],
				played: { kind: "run-through" },
				flaggedSectionIds: [],
			}),
		).toBeNull();
	});

	it("uses whole width for a single one-bar section", () => {
		expect(
			computeSectionBar({
				sections: [{ id: "one", startBar: 8, endBar: 8 }],
				played: {
					kind: "section",
					sectionId: "one",
					ranges: [{ startBar: 8, endBar: 8 }],
				},
				flaggedSectionIds: [],
			}),
		).toEqual({
			segments: [
				{ sectionId: "one", start: 0, width: 1, fill: 1, flagged: false }, // invariants:allow
			],
		});
	});

	it("keeps identical ranges rather than removing every segment", () => {
		const result = computeSectionBar({
			sections: [sections[0], { ...sections[0], id: "repeat" }],
			played: { kind: "run-through" },
			flaggedSectionIds: [],
		});
		expect(result?.segments.map(({ width }) => width)).toEqual([0.5, 0.5]);
	});
});
