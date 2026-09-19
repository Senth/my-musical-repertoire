import type { Section, SectionState } from "@/models/section";
import {
	buildSpanRuns,
	enumerateSpanWindows,
	type SpanSection,
	selectSpanWindow,
	spanWindowsFor,
} from "./span-detection";
import { makeSection } from "./test-factories";

function sec(
	id: string,
	startBar: number | null,
	endBar: number | null,
	over: Partial<Section> = {},
): Section {
	return makeSection({
		id,
		pieceId: "p",
		state: "stabilizing" as SectionState,
		startBar,
		endBar,
		...over,
	});
}

function ids(sections: Section[]): (string | undefined)[] {
	return sections.map((s) => s.id);
}

function runIds(sections: Section[]): (string | undefined)[][] {
	return buildSpanRuns(sections).map(ids);
}

describe("buildSpanRuns — the four grilling cases", () => {
	it("1-20, 21-30, 31-35 makes one run of 3", () => {
		expect(
			runIds([sec("a", 1, 20), sec("b", 21, 30), sec("c", 31, 35)]),
		).toEqual([["a", "b", "c"]]);
	});

	it("1-20, 20-30, 30-35 (touching) makes one run of 3", () => {
		expect(
			runIds([sec("a", 1, 20), sec("b", 20, 30), sec("c", 30, 35)]),
		).toEqual([["a", "b", "c"]]);
	});

	it("1-20, 19-30, 28-35 (overlapping) makes one run of 3", () => {
		expect(
			runIds([sec("a", 1, 20), sec("b", 19, 30), sec("c", 28, 35)]),
		).toEqual([["a", "b", "c"]]);
	});

	it("1-20, 22-30, bar-less, 32-35 makes no run", () => {
		expect(
			runIds([
				sec("a", 1, 20),
				sec("b", 22, 30),
				sec("c", null, null),
				sec("d", 32, 35),
			]),
		).toEqual([]);
	});

	it("1-20, 22-30, bar-less, 31-35 makes one run of the 2nd and 4th", () => {
		expect(
			runIds([
				sec("a", 1, 20),
				sec("b", 22, 30),
				sec("c", null, null),
				sec("d", 31, 35),
			]),
		).toEqual([["b", "d"]]);
	});
});

describe("buildSpanRuns — nesting", () => {
	it("skips a nested section without breaking the run", () => {
		expect(
			runIds([sec("a", 1, 20), sec("nested", 10, 15), sec("b", 21, 30)]),
		).toEqual([["a", "b"]]);
	});

	it("sorts the longer section first on an equal startBar, so the shorter nests", () => {
		expect(
			runIds([sec("short", 1, 10), sec("long", 1, 20), sec("b", 21, 30)]),
		).toEqual([["long", "b"]]);
	});
});

describe("buildSpanRuns — transparency", () => {
	it("treats an archived section as transparent", () => {
		expect(
			runIds([
				sec("a", 1, 20),
				sec("gone", 21, 30, { archived: true }),
				sec("b", 21, 30),
			]),
		).toEqual([["a", "b"]]);
	});

	it("treats a section missing only endBar as transparent", () => {
		expect(
			runIds([sec("a", 1, 20), sec("open", 21, null), sec("b", 21, 30)]),
		).toEqual([["a", "b"]]);
	});
});

describe("buildSpanRuns — readiness", () => {
	it("breaks the run on a learning section that carries bars", () => {
		expect(
			runIds([
				sec("a", 1, 20),
				sec("mid", 21, 30, { state: "learning" }),
				sec("b", 31, 40),
			]),
		).toEqual([]);
	});

	it("breaks the run on a not_started section, even when nested", () => {
		expect(
			runIds([
				sec("a", 1, 20),
				sec("mid", 10, 15, { state: "not_started" }),
				sec("b", 21, 30),
			]),
		).toEqual([]);
	});

	it("keeps a maintenance section in the run", () => {
		expect(
			runIds([sec("a", 1, 20, { state: "maintenance" }), sec("b", 21, 30)]),
		).toEqual([["a", "b"]]);
	});
});

describe("enumerateSpanWindows", () => {
	it("gives a run of 5 three windows of 3", () => {
		const run = buildSpanRuns([
			sec("a", 1, 10),
			sec("b", 11, 20),
			sec("c", 21, 30),
			sec("d", 31, 40),
			sec("e", 41, 50),
		])[0];
		expect(enumerateSpanWindows(run).map(ids)).toEqual([
			["a", "b", "c"],
			["b", "c", "d"],
			["c", "d", "e"],
		]);
	});

	it("gives a run of 2 one window of 2", () => {
		const run = buildSpanRuns([sec("a", 1, 10), sec("b", 11, 20)])[0];
		expect(enumerateSpanWindows(run).map(ids)).toEqual([["a", "b"]]);
	});
});

describe("selectSpanWindow", () => {
	const day = (d: number) => new Date(2026, 7, d, 12, 0);

	it("prefers a stale pair over a fresher trio", () => {
		const stale = spanWindowsFor([
			sec("s1", 1, 10, { pieceId: "p1", lastPracticed: day(1) }),
			sec("s2", 11, 20, { pieceId: "p1", lastPracticed: day(1) }),
		]);
		const fresh = spanWindowsFor([
			sec("f1", 1, 10, { pieceId: "p2", lastPracticed: day(20) }),
			sec("f2", 11, 20, { pieceId: "p2", lastPracticed: day(20) }),
			sec("f3", 21, 30, { pieceId: "p2", lastPracticed: day(20) }),
		]);
		expect(
			ids(selectSpanWindow([...fresh, ...stale]) as SpanSection[]),
		).toEqual(["s1", "s2"]);
	});

	it("prefers a window holding a never-practised section", () => {
		const windows = spanWindowsFor([
			sec("a", 1, 10, { lastPracticed: day(2) }),
			sec("b", 11, 20, { lastPracticed: day(2) }),
			sec("c", 21, 30, { lastPracticed: day(2) }),
			sec("d", 31, 40, { lastPracticed: null }),
		]);
		expect(ids(selectSpanWindow(windows) as SpanSection[])).toEqual([
			"b",
			"c",
			"d",
		]);
	});

	it("breaks a tie on the lower startBar", () => {
		const windows = spanWindowsFor([
			sec("a", 1, 10, { lastPracticed: day(5) }),
			sec("b", 11, 20, { lastPracticed: day(5) }),
			sec("c", 21, 30, { lastPracticed: day(5) }),
			sec("d", 31, 40, { lastPracticed: day(5) }),
		]);
		expect(ids(selectSpanWindow(windows) as SpanSection[])).toEqual([
			"a",
			"b",
			"c",
		]);
	});

	it("returns null when there is no window", () => {
		expect(selectSpanWindow([])).toBeNull();
	});
});
