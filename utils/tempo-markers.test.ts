import { placeTempoMarkers, type TempoMark } from "./tempo-markers";

const TRACK = 330;
const GAP = 8;

const place = (marks: TempoMark[]) =>
	placeTempoMarkers({ trackWidth: TRACK, gap: GAP, marks });

const x = (bpm: number, max: number) => ((bpm - 20) / (max - 20)) * TRACK;

const mark = (
	id: TempoMark["id"],
	value: number,
	pos: number,
	width: number,
): TempoMark => ({ id, value, x: pos, width });

const byId = (placed: ReturnType<typeof place>, id: TempoMark["id"]) => {
	const found = placed.find((p) => p.id === id);
	if (!found) throw new Error(`no placement for ${id}`);
	return found;
};

describe("placeTempoMarkers", () => {
	it("equal values: coincident arrows, last right-aligned, target left-aligned", () => {
		const pos = x(110, 147);
		const placed = place([
			mark("last", 110, pos, 47),
			mark("target", 110, pos, 58),
		]);
		expect(byId(placed, "last").side).toBe("left");
		expect(byId(placed, "last").right).toBeCloseTo(pos, 2);
		expect(byId(placed, "target").side).toBe("right");
		expect(byId(placed, "target").left).toBeCloseTo(pos + GAP, 2);
		expect(byId(placed, "last").anchored).toBe(true);
		expect(byId(placed, "target").anchored).toBe(true);
	});

	it("92 and 110: both anchored, each beside its own arrow", () => {
		const posLast = x(92, 147);
		const posTarget = x(110, 147);
		const placed = place([
			mark("last", 92, posLast, 47),
			mark("target", 110, posTarget, 58),
		]);
		expect(byId(placed, "last").anchored).toBe(true);
		expect(byId(placed, "last").side).toBe("left");
		expect(byId(placed, "last").right).toBeCloseTo(posLast, 2);
		expect(byId(placed, "target").anchored).toBe(true);
		expect(byId(placed, "target").side).toBe("right");
		expect(byId(placed, "target").left).toBeCloseTo(posTarget, 2);
	});

	it("104 and 110: anchored with no drift off either arrow", () => {
		const posLast = x(104, 147);
		const posTarget = x(110, 147);
		const placed = place([
			mark("last", 104, posLast, 47),
			mark("target", 110, posTarget, 58),
		]);
		expect(byId(placed, "last").side).toBe("left");
		expect(byId(placed, "last").right).toBeCloseTo(posLast, 2);
		expect(byId(placed, "target").side).toBe("right");
		expect(byId(placed, "target").left).toBeCloseTo(posTarget, 2);
	});

	it("118 over 104: the values decide sides, not the roles", () => {
		const posLast = x(118, 158);
		const posTarget = x(104, 158);
		const placed = place([
			mark("last", 118, posLast, 47),
			mark("target", 104, posTarget, 58),
		]);
		expect(byId(placed, "target").side).toBe("left");
		expect(byId(placed, "target").right).toBeCloseTo(posTarget, 2);
		expect(byId(placed, "last").side).toBe("right");
		expect(byId(placed, "last").left).toBeCloseTo(posLast, 2);
	});

	it("a single mark stays centred on its arrow", () => {
		const pos = x(26, 100);
		const placed = place([mark("last", 26, pos, 41)]);
		const last = byId(placed, "last");
		expect(last.side).toBe("centre");
		expect(last.anchored).toBe(false);
		expect(last.left).toBeCloseTo(pos - 20.5, 2);
		expect(last.right).toBeCloseTo(pos + 20.5, 2);
	});

	it("140 and 146 at the right edge: target flips and is shoved left of last", () => {
		const posLast = x(140, 148);
		const posTarget = x(146, 148);
		const placed = place([
			mark("last", 140, posLast, 47),
			mark("target", 146, posTarget, 58),
		]);
		const last = byId(placed, "last");
		const target = byId(placed, "target");
		expect(last.anchored).toBe(true);
		expect(last.side).toBe("left");
		expect(last.right).toBeCloseTo(posLast, 2);
		expect(target.anchored).toBe(true);
		expect(target.side).toBe("left");
		expect(target.right).toBeCloseTo(last.left - GAP, 2);
	});

	it("24 and 26 at the left edge: last flips right, target packs outside it", () => {
		const posLast = x(24, 148);
		const posTarget = x(26, 148);
		const placed = place([
			mark("last", 24, posLast, 41),
			mark("target", 26, posTarget, 52),
		]);
		const last = byId(placed, "last");
		const target = byId(placed, "target");
		expect(last.anchored).toBe(true);
		expect(last.side).toBe("right");
		expect(last.left).toBeCloseTo(posLast, 2);
		expect(target.anchored).toBe(true);
		expect(target.side).toBe("right");
		expect(target.left).toBeCloseTo(last.right + GAP, 2);
	});

	it("far apart: both stay centred on their own arrows", () => {
		const posLast = x(40, 240);
		const posTarget = x(200, 240);
		const placed = place([
			mark("last", 40, posLast, 47),
			mark("target", 200, posTarget, 58),
		]);
		expect(byId(placed, "last").side).toBe("centre");
		expect(byId(placed, "last").anchored).toBe(false);
		expect(byId(placed, "target").side).toBe("centre");
		expect(byId(placed, "target").anchored).toBe(false);
	});
});
