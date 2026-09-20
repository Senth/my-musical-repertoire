import type { SpanSection } from "./span-detection";
import { spanIsDue, spanIsReady } from "./span-trigger";
import { makePiece, makeSection } from "./test-factories";

function span(startBar: number, endBar: number): SpanSection {
	return makeSection({
		id: "s",
		pieceId: "p",
		state: "stabilizing",
		startBar,
		endBar,
	}) as SpanSection;
}

const now = new Date("2026-01-10T12:00:00");

describe("spanIsDue", () => {
	it("is due when never spanned", () => {
		const piece = makePiece({ id: "p", lastSpanPracticedAt: null });
		expect(spanIsDue(piece, now)).toBe(true);
	});

	it("is due at four practice days", () => {
		const piece = makePiece({
			id: "p",
			lastSpanPracticedAt: new Date("2026-01-08T12:00:00"),
			practiceDaysSinceSpan: 4,
		});
		expect(spanIsDue(piece, now)).toBe(true);
	});

	it("is due eight calendar days stale even with few practice days", () => {
		const piece = makePiece({
			id: "p",
			lastSpanPracticedAt: new Date("2026-01-02T12:00:00"),
			practiceDaysSinceSpan: 1,
		});
		expect(spanIsDue(piece, now)).toBe(true);
	});

	it("is not due at three practice days and a five-day-old span", () => {
		const piece = makePiece({
			id: "p",
			lastSpanPracticedAt: new Date("2026-01-05T12:00:00"),
			practiceDaysSinceSpan: 3,
		});
		expect(spanIsDue(piece, now)).toBe(false);
	});
});

describe("spanIsReady", () => {
	it("passes when target is null", () => {
		const piece = makePiece({ id: "p", targetTempoBpm: null });
		expect(spanIsReady(piece, [span(1, 10)])).toBe(true);
	});

	it("fails when HT bpm is missing", () => {
		const piece = makePiece({ id: "p", targetTempoBpm: 100 });
		expect(spanIsReady(piece, [span(1, 10)])).toBe(false);
	});

	it("fails at 84% of target", () => {
		const piece = makePiece({ id: "p", targetTempoBpm: 100 });
		const section = span(1, 10);
		section.byMode = { HT: { bpm: 84 } };
		expect(spanIsReady(piece, [section])).toBe(false);
	});

	it("passes at 85% of target", () => {
		const piece = makePiece({ id: "p", targetTempoBpm: 100 });
		const section = span(1, 10);
		section.byMode = { HT: { bpm: 85 } };
		expect(spanIsReady(piece, [section])).toBe(true);
	});

	it("uses the section's targetBpmOverride over the piece's target", () => {
		const piece = makePiece({ id: "p", targetTempoBpm: 100 });
		const failing = span(1, 10);
		failing.targetBpmOverride = 200;
		failing.byMode = { HT: { bpm: 169 } };
		expect(spanIsReady(piece, [failing])).toBe(false);

		const passing = span(1, 10);
		passing.targetBpmOverride = 200;
		passing.byMode = { HT: { bpm: 170 } };
		expect(spanIsReady(piece, [passing])).toBe(true);
	});
});
