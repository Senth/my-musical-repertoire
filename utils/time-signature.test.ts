import type { TimeSignature } from "./time-signature";
import {
	formatTimeSignature,
	NOTE_VALUES,
	PRESETS,
	planTimeSignatureWrite,
	resolveTimeSignature,
	timeSignatureFromFirestore,
	writesFromPlan,
} from "./time-signature";

const SEVEN_EIGHT: TimeSignature = { beats: 7, noteValue: 8 };
const FOUR_FOUR: TimeSignature = { beats: 4, noteValue: 4 };

describe("formatTimeSignature", () => {
	it("formats 7/8", () => {
		expect(formatTimeSignature(SEVEN_EIGHT)).toBe("7/8");
	});
});

describe("NOTE_VALUES and PRESETS", () => {
	it("carries the eight powers of two", () => {
		expect(NOTE_VALUES).toEqual([1, 2, 4, 8, 16, 32, 64, 128]);
	});

	it("carries 2/4, 3/4, 4/4 and 6/8", () => {
		expect(PRESETS).toEqual([
			{ beats: 2, noteValue: 4 },
			{ beats: 3, noteValue: 4 },
			{ beats: 4, noteValue: 4 },
			{ beats: 6, noteValue: 8 },
		]);
	});
});

describe("resolveTimeSignature", () => {
	it("prefers the section override", () => {
		expect(
			resolveTimeSignature(
				{ timeSignatureOverride: SEVEN_EIGHT },
				{ timeSignature: FOUR_FOUR },
			),
		).toEqual(SEVEN_EIGHT);
	});

	it("falls back to the piece when the override is cleared", () => {
		expect(
			resolveTimeSignature(
				{ timeSignatureOverride: null },
				{ timeSignature: FOUR_FOUR },
			),
		).toEqual(FOUR_FOUR);
	});

	it("reads a technique's own signature with no section", () => {
		expect(resolveTimeSignature(null, { timeSignature: SEVEN_EIGHT })).toEqual(
			SEVEN_EIGHT,
		);
	});

	it("is null when nothing is stored", () => {
		expect(resolveTimeSignature(null, null)).toBeNull();
		expect(resolveTimeSignature({}, {})).toBeNull();
	});
});

describe("planTimeSignatureWrite", () => {
	it("writes the piece and clears a stale override when the piece has none", () => {
		expect(
			planTimeSignatureWrite(
				SEVEN_EIGHT,
				{},
				{ timeSignatureOverride: FOUR_FOUR },
			),
		).toEqual({ target: "piece", piece: SEVEN_EIGHT, sectionOverride: null });
	});

	it("writes the piece alone when there is no section in scope either", () => {
		expect(planTimeSignatureWrite(SEVEN_EIGHT, {}, null)).toEqual({
			target: "piece",
			piece: SEVEN_EIGHT,
		});
	});

	it("clears the section override when the new value equals the piece's", () => {
		expect(
			planTimeSignatureWrite(
				FOUR_FOUR,
				{ timeSignature: FOUR_FOUR },
				{ timeSignatureOverride: SEVEN_EIGHT },
			),
		).toEqual({ target: "section", sectionOverride: null });
	});

	it("does nothing when the value equals the piece's and no section is in scope", () => {
		expect(
			planTimeSignatureWrite(FOUR_FOUR, { timeSignature: FOUR_FOUR }, null),
		).toEqual({ target: "none" });
	});

	it("writes the section override when the value differs from the piece's", () => {
		expect(
			planTimeSignatureWrite(
				SEVEN_EIGHT,
				{ timeSignature: FOUR_FOUR },
				{ timeSignatureOverride: null },
			),
		).toEqual({ target: "section", sectionOverride: SEVEN_EIGHT });
	});

	it("rewrites the piece when the value differs and no section is in scope", () => {
		expect(
			planTimeSignatureWrite(SEVEN_EIGHT, { timeSignature: FOUR_FOUR }, null),
		).toEqual({ target: "piece", piece: SEVEN_EIGHT });
	});

	it("always targets the technique — no override axis exists", () => {
		expect(planTimeSignatureWrite(SEVEN_EIGHT, null, null)).toEqual({
			target: "technique",
		});
	});

	it("tells 4/4 and 8/8 apart, not just the beats", () => {
		expect(
			planTimeSignatureWrite(
				{ beats: 8, noteValue: 8 },
				{ timeSignature: { beats: 4, noteValue: 4 } },
				{ timeSignatureOverride: null },
			),
		).toEqual({
			target: "section",
			sectionOverride: { beats: 8, noteValue: 8 },
		});
	});
});

describe("writesFromPlan", () => {
	it("carries both legs when the piece write must also clear a stale override", () => {
		// Row 1 of the override table: only writing the piece would leave the
		// override winning in resolveTimeSignature, silently dropping the pick.
		expect(
			writesFromPlan({
				target: "piece",
				piece: SEVEN_EIGHT,
				sectionOverride: null,
			}),
		).toEqual({ piece: SEVEN_EIGHT, sectionOverride: null });
	});

	it("carries only the piece leg when no section is in scope", () => {
		expect(writesFromPlan({ target: "piece", piece: SEVEN_EIGHT })).toEqual({
			piece: SEVEN_EIGHT,
		});
	});

	it("carries the override leg when the plan targets the section", () => {
		expect(
			writesFromPlan({ target: "section", sectionOverride: SEVEN_EIGHT }),
		).toEqual({ sectionOverride: SEVEN_EIGHT });
		expect(
			writesFromPlan({ target: "section", sectionOverride: null }),
		).toEqual({ sectionOverride: null });
	});

	it("carries nothing for technique and no-op plans", () => {
		expect(writesFromPlan({ target: "technique" })).toEqual({});
		expect(writesFromPlan({ target: "none" })).toEqual({});
	});
});

describe("timeSignatureFromFirestore", () => {
	it("reads back what a write stored — the full round trip", () => {
		// updateDoc stores `{ beats, noteValue }` as a plain object; this is
		// the read half of that round trip, which no test used to cover.
		const stored = JSON.parse(JSON.stringify(SEVEN_EIGHT));
		expect(timeSignatureFromFirestore(stored)).toEqual(SEVEN_EIGHT);
		expect(timeSignatureFromFirestore({ beats: 4, noteValue: 4 })).toEqual(
			FOUR_FOUR,
		);
	});

	it("reads absent and malformed fields as null", () => {
		expect(timeSignatureFromFirestore(undefined)).toBeNull();
		expect(timeSignatureFromFirestore(null)).toBeNull();
		expect(timeSignatureFromFirestore("4/4")).toBeNull();
		expect(timeSignatureFromFirestore({ beats: 4 })).toBeNull();
		expect(timeSignatureFromFirestore({ beats: 4, noteValue: 3 })).toBeNull();
		expect(timeSignatureFromFirestore({ beats: "4", noteValue: 4 })).toBeNull();
	});
});
