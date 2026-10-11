import type { Section, SectionState } from "@/models/section";
import { sectionsMissingSpanBars } from "./span-missing-bars";
import { makeSection } from "./test-factories";

function sec(
	id: string,
	order: number,
	startBar: number | null = null,
	endBar: number | null = null,
	over: Partial<Section> = {},
): Section {
	return makeSection({
		id,
		pieceId: "p",
		state: "stabilizing" as SectionState,
		order,
		startBar,
		endBar,
		...over,
	});
}

function ids(sections: Section[]): (string | undefined)[] {
	return sections.map((section) => section.id);
}

describe("sectionsMissingSpanBars", () => {
	it("returns both bar-less stabilizing neighbours", () => {
		expect(ids(sectionsMissingSpanBars([sec("a", 0), sec("b", 1)]))).toEqual([
			"a",
			"b",
		]);
	});

	it("counts a maintenance neighbour as span-qualifying", () => {
		expect(
			ids(
				sectionsMissingSpanBars([
					sec("a", 0, null, null, { state: "maintenance" }),
					sec("b", 1),
				]),
			),
		).toEqual(["a", "b"]);
	});

	it("returns only bar-less section when its neighbour has bars", () => {
		expect(
			ids(sectionsMissingSpanBars([sec("ready", 0, 1, 10), sec("missing", 1)])),
		).toEqual(["missing"]);
	});

	it("ignores a learning neighbour", () => {
		expect(
			sectionsMissingSpanBars([
				sec("ready", 0),
				sec("learning", 1, null, null, { state: "learning" }),
			]),
		).toEqual([]);
	});

	it("skips an archived section between qualifying neighbours", () => {
		expect(
			ids(
				sectionsMissingSpanBars([
					sec("a", 0),
					sec("archived", 1, null, null, { archived: true }),
					sec("b", 2),
				]),
			),
		).toEqual(["a", "b"]);
	});

	it("treats a section with only startBar as missing bars", () => {
		expect(
			ids(
				sectionsMissingSpanBars([sec("partial", 0, 1), sec("ready", 1, 2, 10)]),
			),
		).toEqual(["partial"]);
	});

	it("treats non-finite bar values as missing", () => {
		expect(
			ids(
				sectionsMissingSpanBars([
					sec("invalid", 0, Number.POSITIVE_INFINITY, 10),
					sec("ready", 1, 11, 20),
				]),
			),
		).toEqual(["invalid"]);
	});

	it("returns empty when all neighbouring sections have bars", () => {
		expect(
			sectionsMissingSpanBars([sec("a", 0, 1, 10), sec("b", 1, 11, 20)]),
		).toEqual([]);
	});

	it("returns empty when qualifying sections are separated by a learning section", () => {
		expect(
			sectionsMissingSpanBars([
				sec("a", 0),
				sec("learning", 1, null, null, { state: "learning" }),
				sec("b", 2),
			]),
		).toEqual([]);
	});

	it("returns distinct missing sections in section order, not input order", () => {
		expect(
			ids(
				sectionsMissingSpanBars([
					sec("last", 2),
					sec("first", 0),
					sec("middle", 1),
				]),
			),
		).toEqual(["first", "middle", "last"]);
	});
});
