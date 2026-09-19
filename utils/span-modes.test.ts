import type { Piece } from "@/models/piece";
import type { ByMode } from "@/models/practice";
import type { SpanSection } from "./span-detection";
import { spanModeStats, spanPreselectHands } from "./span-modes";

function section(
	startBar: number,
	endBar: number,
	byMode?: ByMode,
	targetBpmOverride?: number | null,
): SpanSection {
	return {
		pieceId: "p1",
		userId: "u1",
		label: `${startBar}-${endBar}`,
		order: startBar,
		state: "stabilizing",
		archived: false,
		startBar,
		endBar,
		byMode,
		targetBpmOverride: targetBpmOverride ?? null,
	};
}

function piece(targetTempoBpm: number | null): Piece {
	return {
		userId: "u1",
		title: "Sonata",
		composer: "Mozart",
		state: "learning",
		targetTempoBpm,
	} as Piece;
}

describe("spanPreselectHands", () => {
	it("opens HT when every section is HT-ready against its own target", () => {
		const sections = [
			section(1, 16, { LH: { bpm: 100 }, RH: { bpm: 100 } }, 80),
			section(17, 32, { LH: { bpm: 60 }, RH: { bpm: 60 } }, 50),
		];
		expect(spanPreselectHands(sections, piece(null))).toBe("HT");
	});

	it("picks the weaker hand across the span when one section fails HT-ready", () => {
		const sections = [
			// Target 100 -> hands-separate target 115. LH far behind.
			section(1, 16, { LH: { bpm: 40 }, RH: { bpm: 110 } }, 100),
			// Target 50 -> hands-separate target 57.5. Both close.
			section(17, 32, { LH: { bpm: 55 }, RH: { bpm: 55 } }, 50),
		];
		expect(spanPreselectHands(sections, piece(null))).toBe("LH");
	});

	it("a fast section against a high target does not mask a slow one against a low target", () => {
		// This is the case a synthesised byMode would get wrong: merging the two
		// sections' stats loses which target each bpm was measured against.
		const sections = [
			section(1, 16, { LH: { bpm: 200 }, RH: { bpm: 200 } }, 180),
			section(17, 32, { LH: { bpm: 10 }, RH: { bpm: 60 } }, 50),
		];
		expect(spanPreselectHands(sections, piece(null))).toBe("LH");
	});
});

describe("spanModeStats", () => {
	it("takes the minimum bpm, quality and effort, and the oldest lastPracticed", () => {
		const sections = [
			section(1, 16, {
				HT: {
					bpm: 90,
					quality: 4,
					effort: 2,
					lastPracticed: new Date("2024-01-05"),
				},
			}),
			section(17, 32, {
				HT: {
					bpm: 70,
					quality: 3,
					effort: 3,
					lastPracticed: new Date("2024-01-01"),
				},
			}),
		];
		expect(spanModeStats(sections, "HT")).toEqual({
			bpm: 70,
			quality: 3,
			effort: 2,
			lastPracticed: new Date("2024-01-01"),
		});
	});

	it("ignores sections missing the mode", () => {
		const sections = [
			section(1, 16, { HT: { bpm: 90, quality: 4, effort: 2 } }),
			section(17, 32, {}),
		];
		expect(spanModeStats(sections, "HT").bpm).toBe(90);
	});

	it("returns all-null when no section holds the mode", () => {
		const sections = [section(1, 16, {}), section(17, 32, {})];
		expect(spanModeStats(sections, "HT")).toEqual({
			bpm: null,
			quality: null,
			effort: null,
			lastPracticed: null,
		});
	});
});
