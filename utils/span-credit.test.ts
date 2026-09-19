import type { ByMode } from "@/models/practice";
import type { ModeEntry } from "./practice-modes";
import { computeSpanCredit, type SpanCreditInput } from "./span-credit";
import type { SpanSection } from "./span-detection";
import { makeSection } from "./test-factories";

const NOW = new Date("2026-08-08T10:00:00Z");
const EARLIER = new Date("2026-08-01T10:00:00Z");

function ht(over: Partial<ByMode["HT"]> = {}): ByMode {
	return {
		HT: { bpm: 90, quality: 3, effort: 3, lastPracticed: EARLIER, ...over },
	};
}

function spanSection(
	over: Partial<SpanSection> & { id: string; startBar: number; endBar: number },
): SpanSection {
	return makeSection({
		pieceId: "p1",
		state: "stabilizing",
		...over,
	}) as SpanSection;
}

function entry(over: Partial<ModeEntry> = {}): ModeEntry {
	return { hands: "HT", drill: null, bpm: 100, quality: 4, effort: 3, ...over };
}

function credit(over: Partial<SpanCreditInput> & { window: SpanSection[] }) {
	return computeSpanCredit({
		entries: [entry()],
		seamChecked: over.window.slice(1).map(() => true),
		now: NOW,
		...over,
	});
}

describe("computeSpanCredit", () => {
	it("raises BPM only: a section stored higher than the span stays untouched", () => {
		const [c] = credit({
			window: [
				spanSection({
					id: "a",
					startBar: 1,
					endBar: 20,
					byMode: ht({ bpm: 90 }),
				}),
			],
			entries: [entry({ bpm: 76 })],
			seamChecked: [],
		});
		expect(c.byMode.HT?.bpm).toBe(90);
	});

	it("raises BPM when the span was faster than stored", () => {
		const [c] = credit({
			window: [
				spanSection({
					id: "a",
					startBar: 1,
					endBar: 20,
					byMode: ht({ bpm: 90 }),
				}),
			],
			entries: [entry({ bpm: 110 })],
			seamChecked: [],
		});
		expect(c.byMode.HT?.bpm).toBe(110);
	});

	it("withholds quality and effort from both sections adjacent to a broken seam, leaves the third untouched, always writes lastPracticed", () => {
		const a = spanSection({
			id: "a",
			startBar: 1,
			endBar: 20,
			byMode: ht({ quality: 2, effort: 2 }),
		});
		const b = spanSection({
			id: "b",
			startBar: 21,
			endBar: 30,
			byMode: ht({ quality: 2, effort: 2 }),
		});
		const c = spanSection({
			id: "c",
			startBar: 31,
			endBar: 40,
			byMode: ht({ quality: 2, effort: 2 }),
		});
		const [ca, cb, cc] = credit({
			window: [a, b, c],
			entries: [entry({ quality: 5, effort: 5 })],
			seamChecked: [false, true],
		});

		expect(ca.byMode.HT?.quality).toBe(2);
		expect(ca.byMode.HT?.effort).toBe(2);
		expect(cb.byMode.HT?.quality).toBe(2);
		expect(cb.byMode.HT?.effort).toBe(2);
		expect(cc.byMode.HT?.quality).toBe(5);
		expect(cc.byMode.HT?.effort).toBe(5);

		expect(ca.byMode.HT?.lastPracticed).toEqual(NOW);
		expect(cb.byMode.HT?.lastPracticed).toEqual(NOW);
		expect(cc.byMode.HT?.lastPracticed).toEqual(NOW);
	});

	it("logs the entered quality even where byMode withheld it", () => {
		const a = spanSection({
			id: "a",
			startBar: 1,
			endBar: 20,
			byMode: ht({ quality: 2, effort: 2 }),
		});
		const b = spanSection({
			id: "b",
			startBar: 21,
			endBar: 30,
			byMode: ht({ quality: 2, effort: 2 }),
		});
		const [ca] = credit({
			window: [a, b],
			entries: [entry({ quality: 5, effort: 5 })],
			seamChecked: [false],
		});

		expect(ca.byMode.HT?.quality).toBe(2);
		expect(ca.logs[0].quality).toBe(5);
		expect(ca.logs[0].effort).toBe(5);
	});

	it("writes seamBefore/seamAfter from both sides of each seam", () => {
		const a = spanSection({ id: "a", startBar: 1, endBar: 20 });
		const b = spanSection({ id: "b", startBar: 21, endBar: 30 });
		const c = spanSection({ id: "c", startBar: 31, endBar: 40 });
		const [ca, cb, cc] = credit({
			window: [a, b, c],
			entries: [entry()],
			seamChecked: [true, false],
		});

		expect(ca.logs[0].seamBefore).toBeNull();
		expect(ca.logs[0].seamAfter).toBe("held");
		expect(cb.logs[0].seamBefore).toBe("held");
		expect(cb.logs[0].seamAfter).toBe("broken");
		expect(cc.logs[0].seamBefore).toBe("broken");
		expect(cc.logs[0].seamAfter).toBeNull();
	});

	it("carries the span's sectionIds, in play order, on every log row", () => {
		const a = spanSection({ id: "a", startBar: 1, endBar: 20 });
		const b = spanSection({ id: "b", startBar: 21, endBar: 30 });
		const [ca, cb] = credit({ window: [a, b] });
		expect(ca.logs[0].sectionIds).toEqual(["a", "b"]);
		expect(cb.logs[0].sectionIds).toEqual(["a", "b"]);
	});

	it("writes one row per practised mode: LH then HT gives two rows per section", () => {
		const a = spanSection({ id: "a", startBar: 1, endBar: 20 });
		const b = spanSection({ id: "b", startBar: 21, endBar: 30 });
		const [ca] = credit({
			window: [a, b],
			entries: [entry({ hands: "LH" }), entry({ hands: "HT" })],
			seamChecked: [true],
		});
		expect(ca.logs).toHaveLength(2);
		expect(ca.logs.map((l) => l.hands)).toEqual(["LH", "HT"]);
		expect(ca.byMode.LH).toBeDefined();
		expect(ca.byMode.HT).toBeDefined();
	});

	it("marks every log row with source span", () => {
		const a = spanSection({ id: "a", startBar: 1, endBar: 20 });
		const b = spanSection({ id: "b", startBar: 21, endBar: 30 });
		const [ca] = credit({ window: [a, b] });
		expect(ca.logs[0].source).toBe("span");
	});
});
