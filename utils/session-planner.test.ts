import type { Piece, PieceState } from "@/models/piece";
import type { Section } from "@/models/section";
import type { SessionAllocation } from "@/models/session";
import type { TechniqueItem, TechniqueState } from "@/models/technique";
import {
	buildPlan,
	CANONICAL_BLOCK_ORDER,
	pickRepertoireLearningBlocks,
	pickRepertoireMaintenanceBlocks,
	pickRepertoireSection,
	pickRepertoireStabilizingBlocks,
	pickTechnique,
	pickWarmup,
	planTotalMinutes,
	redistributeForAvailability,
	type SlotAvailability,
	type SlotMinutes,
} from "./session-planner";
import { makePiece, makeSection, makeTechnique } from "./test-factories";

/**
 * The old balanced 30-minute reference row, resolved: technique 7, reading 4,
 * repertoire 19 split 55/30/15. Keeping the numbers means every downstream
 * assertion still exercises the same arithmetic the planner used to derive.
 */
function alloc(overrides: Partial<SessionAllocation> = {}): SessionAllocation {
	return {
		warmup: 0,
		sightReading: 4,
		technique: 7,
		repertoireLearning: 10.45,
		repertoireStabilizing: 5.7,
		repertoireMaintenance: 2.85,
		...overrides,
	};
}

/** The old balanced 60-minute row: warmup 5, tech 12, reading 8, rep 35. */
const BALANCED_60: SessionAllocation = {
	warmup: 5,
	sightReading: 8,
	technique: 12,
	repertoireLearning: 19.25,
	repertoireStabilizing: 10.5,
	repertoireMaintenance: 5.25,
};

const NOW = new Date("2026-05-27T12:00:00Z");

describe("CANONICAL_BLOCK_ORDER", () => {
	it("puts reading directly after warmup and review before learning", () => {
		expect(CANONICAL_BLOCK_ORDER).toEqual([
			"warmup",
			"sight-reading",
			"technique",
			"repertoire-review",
			"repertoire-learning",
			"repertoire-stabilizing",
			"repertoire-maintenance",
		]);
	});
});

describe("pickRepertoireSection", () => {
	it("picks highest score among learning pieces", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", title: "A", state: "learning" }),
			makePiece({ id: "p2", title: "B", state: "learning" }),
		];
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: new Date(NOW.getTime() - 10 * 86400000),
			}),
			makeSection({
				id: "s2",
				pieceId: "p2",
				phase: "learning",
				lastPracticed: new Date(NOW.getTime() - 1 * 86400000),
			}),
		];
		const b = pickRepertoireSection("learning", pieces, sections, 10, NOW);
		expect(b?.pieceId).toBe("p1");
		expect(b?.sectionId).toBe("s1");
	});

	it("treats piece with no sections as a virtual section", () => {
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "learning",
				lastPracticed: new Date(NOW.getTime() - 30 * 86400000),
			}),
		];
		const b = pickRepertoireSection("learning", pieces, [], 8, NOW);
		expect(b?.pieceId).toBe("p1");
		expect(b?.sectionId).toBeNull();
	});

	it("BPM gap adds to score", () => {
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "learning",
				title: "A",
				targetTempoBpm: 120,
			}),
			makePiece({
				id: "p2",
				state: "learning",
				title: "B",
				targetTempoBpm: 120,
			}),
		];
		const same = new Date(NOW.getTime() - 1 * 86400000);
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: same,
				currentBpm: 60,
			}),
			makeSection({
				id: "s2",
				pieceId: "p2",
				phase: "learning",
				lastPracticed: same,
				currentBpm: 100,
			}),
		];
		const b = pickRepertoireSection("learning", pieces, sections, 10, NOW);
		expect(b?.pieceId).toBe("p1");
	});

	it("tie-breaks by title ASC then section order ASC", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", title: "B", state: "learning" }),
			makePiece({ id: "p2", title: "A", state: "learning" }),
		];
		const lp = new Date(NOW.getTime() - 5 * 86400000);
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				order: 0,
				lastPracticed: lp,
			}),
			makeSection({
				id: "s2",
				pieceId: "p2",
				phase: "learning",
				order: 0,
				lastPracticed: lp,
			}),
		];
		const b = pickRepertoireSection("learning", pieces, sections, 10, NOW);
		expect(b?.pieceId).toBe("p2");
	});

	it("returns null when no learning pieces", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "maintenance" })];
		const b = pickRepertoireSection("learning", pieces, [], 10, NOW);
		expect(b).toBeNull();
	});

	it("uses section.phase weight for scoring", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const days = new Date(NOW.getTime() - 10 * 86400000);
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				order: 0,
				lastPracticed: days,
			}),
			makeSection({
				id: "s2",
				pieceId: "p1",
				phase: "maintenance",
				order: 1,
				lastPracticed: days,
			}),
		];
		const b = pickRepertoireSection("learning", pieces, sections, 10, NOW);
		expect(b?.sectionId).toBe("s1");
	});
});

describe("pickRepertoireLearningBlocks", () => {
	const days = (n: number) => new Date(NOW.getTime() - n * 86400000);

	it("never spends the whole line on one section (the reported bug)", () => {
		// One learning section and several already-learned ones, 20-minute line.
		// Before the split this was 20 minutes on `s-learn` and nothing else.
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({
				id: "r0",
				pieceId: "p1",
				phase: "stabilizing",
				order: 0,
				lastPracticed: days(9),
			}),
			makeSection({
				id: "r1",
				pieceId: "p1",
				phase: "stabilizing",
				order: 1,
				lastPracticed: days(4),
			}),
			makeSection({
				id: "r2",
				pieceId: "p1",
				phase: "maintenance",
				order: 2,
				lastPracticed: days(2),
			}),
			makeSection({
				id: "s-learn",
				pieceId: "p1",
				phase: "learning",
				order: 3,
				lastPracticed: days(1),
			}),
		];
		const r = pickRepertoireLearningBlocks(pieces, sections, 20, NOW);
		expect(r.learningBlocks.map((b) => b.sectionId)).toEqual(["s-learn"]);
		expect(r.learningBlocks[0].allocatedMinutes).toBeCloseTo(12);
		expect(r.reviewBlocks).toHaveLength(1);
		expect(r.reviewBlocks[0].allocatedMinutes).toBeCloseTo(8);
		expect(r.reviewBlocks[0].sectionId).toBe("r0"); // stalest of the learned ones
		expect(r.leftoverMinutes).toBe(0);
	});

	it("spreads a long line over distinct learning sections", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({
				id: "a",
				pieceId: "p1",
				phase: "learning",
				order: 0,
				lastPracticed: days(3),
			}),
			makeSection({
				id: "b",
				pieceId: "p1",
				phase: "learning",
				order: 1,
				lastPracticed: days(2),
			}),
			makeSection({
				id: "c",
				pieceId: "p1",
				phase: "stabilizing",
				order: 2,
				lastPracticed: days(5),
			}),
		];
		const r = pickRepertoireLearningBlocks(pieces, sections, 24, NOW);
		expect(r.learningBlocks.map((b) => b.sectionId)).toEqual(["a", "b"]);
		expect(r.learningBlocks.every((b) => b.allocatedMinutes === 9)).toBe(true);
		expect(r.reviewBlocks.map((b) => b.sectionId)).toEqual(["c"]);
		expect(r.reviewBlocks[0].allocatedMinutes).toBeCloseTo(6);
	});

	it("reviews the piece it is learning first, even when another scores higher", () => {
		const pieces: Piece[] = [
			makePiece({ id: "pa", title: "A", state: "learning" }),
			makePiece({ id: "pb", title: "B", state: "learning" }),
		];
		const sections: Section[] = [
			makeSection({
				id: "a-learn",
				pieceId: "pa",
				phase: "learning",
				lastPracticed: days(10),
			}),
			makeSection({
				id: "a-review",
				pieceId: "pa",
				phase: "stabilizing",
				lastPracticed: days(1), // score 2.5
			}),
			makeSection({
				id: "b-review",
				pieceId: "pb",
				phase: "stabilizing",
				lastPracticed: days(30), // score 75 — but the wrong piece
			}),
		];
		const r = pickRepertoireLearningBlocks(pieces, sections, 20, NOW);
		expect(r.learningBlocks.map((b) => b.sectionId)).toEqual(["a-learn"]);
		expect(r.reviewBlocks.map((b) => b.sectionId)).toEqual(["a-review"]);
	});

	it("runs the whole line as review when there is nothing new to acquire", () => {
		// A learning-state piece whose sections are all learned already: before
		// this feature the line idled and its minutes went to other slots.
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = ["r0", "r1", "r2"].map((id, i) =>
			makeSection({
				id,
				pieceId: "p1",
				phase: "stabilizing",
				order: i,
				lastPracticed: days(9 - i),
			}),
		);
		const r = pickRepertoireLearningBlocks(pieces, sections, 20, NOW);
		expect(r.learningBlocks).toEqual([]);
		expect(r.reviewBlocks.map((b) => b.sectionId)).toEqual(["r0", "r1", "r2"]);
		expect(r.reviewBlocks.every((b) => b.allocatedMinutes === 20 / 3)).toBe(
			true,
		);
		expect(r.leftoverMinutes).toBe(0);
	});

	it("hands review minutes back to learning, then reports what will not fit", () => {
		// Brand-new piece: one section, nothing learned yet to review.
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1", phase: "learning" }),
		];
		const under = pickRepertoireLearningBlocks(pieces, sections, 13, NOW);
		// 9.75 learning + 3.25 review → the block absorbs 2.25 up to its cap.
		expect(under.learningBlocks[0].allocatedMinutes).toBeCloseTo(12);
		expect(under.reviewBlocks).toEqual([]);
		expect(under.leftoverMinutes).toBeCloseTo(1);

		const over = pickRepertoireLearningBlocks(pieces, sections, 20, NOW);
		expect(over.learningBlocks[0].allocatedMinutes).toBeCloseTo(12);
		expect(over.leftoverMinutes).toBeCloseTo(8);
	});

	it("ignores stabilizing- and maintenance-state pieces entirely", () => {
		const pieces: Piece[] = [
			makePiece({ id: "ps", state: "stabilizing" }),
			makePiece({ id: "pm", state: "maintenance" }),
		];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "ps", phase: "learning" }),
			makeSection({ id: "s2", pieceId: "pm", phase: "stabilizing" }),
		];
		const r = pickRepertoireLearningBlocks(pieces, sections, 20, NOW);
		expect(r.learningBlocks).toEqual([]);
		expect(r.reviewBlocks).toEqual([]);
		expect(r.leftoverMinutes).toBe(20);
	});

	it("respects sections already taken by an earlier block", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({
				id: "a",
				pieceId: "p1",
				phase: "learning",
				order: 0,
				lastPracticed: days(9),
			}),
			makeSection({
				id: "b",
				pieceId: "p1",
				phase: "learning",
				order: 1,
				lastPracticed: days(3),
			}),
		];
		const r = pickRepertoireLearningBlocks(
			pieces,
			sections,
			10,
			NOW,
			new Set(["a"]),
		);
		expect(r.learningBlocks.map((b) => b.sectionId)).toEqual(["b"]);
	});
});

describe("pickRepertoireStabilizingBlocks", () => {
	const days = (n: number) => new Date(NOW.getTime() - n * 86400000);

	it("reaches problem sections inside otherwise-maintenance pieces", () => {
		const pieces: Piece[] = [
			makePiece({ id: "pm", state: "maintenance", lastPracticed: days(2) }),
		];
		const sections: Section[] = [
			makeSection({
				id: "problem",
				pieceId: "pm",
				phase: "stabilizing",
				order: 0,
				lastPracticed: days(6),
			}),
			// A settled section of the same piece belongs to whole-piece run-throughs.
			makeSection({
				id: "settled",
				pieceId: "pm",
				phase: "maintenance",
				order: 1,
				lastPracticed: days(20),
			}),
		];
		const r = pickRepertoireStabilizingBlocks(pieces, sections, 10, NOW);
		expect(r.blocks.map((b) => b.sectionId)).toEqual(["problem"]);
	});

	it("never touches a learning-state piece — that is the learning line's job", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1", phase: "stabilizing" }),
		];
		const r = pickRepertoireStabilizingBlocks(pieces, sections, 10, NOW);
		expect(r.blocks).toEqual([]);
		expect(r.leftoverMinutes).toBe(10);
	});

	it("splits a long line over distinct sections", () => {
		const pieces: Piece[] = [makePiece({ id: "ps", state: "stabilizing" })];
		const sections: Section[] = ["a", "b"].map((id, i) =>
			makeSection({
				id,
				pieceId: "ps",
				phase: "stabilizing",
				order: i,
				lastPracticed: days(9 - i),
			}),
		);
		const r = pickRepertoireStabilizingBlocks(pieces, sections, 20, NOW);
		expect(r.blocks.map((b) => b.sectionId)).toEqual(["a", "b"]);
		expect(r.blocks.every((b) => b.allocatedMinutes === 10)).toBe(true);
		expect(r.leftoverMinutes).toBe(0);
	});

	it("caps the block instead of grinding one section for the whole line", () => {
		const pieces: Piece[] = [makePiece({ id: "ps", state: "stabilizing" })];
		const sections: Section[] = [
			makeSection({ id: "only", pieceId: "ps", phase: "stabilizing" }),
		];
		const r = pickRepertoireStabilizingBlocks(pieces, sections, 20, NOW);
		expect(r.blocks).toHaveLength(1);
		expect(r.blocks[0].allocatedMinutes).toBeCloseTo(12);
		expect(r.leftoverMinutes).toBeCloseTo(8);
	});
});

describe("pickRepertoireMaintenanceBlocks", () => {
	it("includes maintenance + performance pieces, best first", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				title: "A",
				lastPracticed: days,
			}),
			makePiece({
				id: "p2",
				state: "performance",
				title: "B",
				lastPracticed: days,
			}),
		];
		const { blocks } = pickRepertoireMaintenanceBlocks(pieces, 5, NOW);
		// performance × 3 weight beats maintenance × 1 with same staleness
		expect(blocks[0]?.pieceId).toBe("p2");
	});

	it("excludes on_hold and shelved", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "on_hold" as PieceState }),
			makePiece({ id: "p2", state: "shelved" as PieceState }),
		];
		const { blocks, leftoverMinutes } = pickRepertoireMaintenanceBlocks(
			pieces,
			5,
			NOW,
		);
		expect(blocks).toEqual([]);
		expect(leftoverMinutes).toBe(5);
	});

	it("BPM gap influences score ordering", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				title: "A",
				lastPracticed: days,
				targetTempoBpm: 120,
				lastAchievedTempoBpm: 60,
			}),
			makePiece({
				id: "p2",
				state: "maintenance",
				title: "B",
				lastPracticed: days,
				targetTempoBpm: 120,
				lastAchievedTempoBpm: 110,
			}),
		];
		const { blocks } = pickRepertoireMaintenanceBlocks(pieces, 5, NOW);
		expect(blocks[0]?.pieceId).toBe("p1");
	});

	it("packs many pieces using duration × 1.2 cost", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		// Three 5-min play-throughs → cost 6 each. Budget 13, allowance 16:
		// 6 fits, 12 fits, 18 does not.
		const pieces: Piece[] = ["A", "B", "C"].map((title, i) =>
			makePiece({
				id: `p${i + 1}`,
				state: "maintenance",
				title,
				lastPracticed: days,
				durationSeconds: 300,
			}),
		);
		const { blocks, leftoverMinutes, inflationMinutes } =
			pickRepertoireMaintenanceBlocks(pieces, 13, NOW);
		expect(blocks).toHaveLength(2);
		expect(blocks.every((b) => b.allocatedMinutes === 6)).toBe(true);
		expect(leftoverMinutes).toBe(1);
		expect(inflationMinutes).toBe(0);
	});

	it("keeps the cost fractional", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 210, // 3.5 min → cost 4.2
			}),
		];
		const { blocks } = pickRepertoireMaintenanceBlocks(pieces, 10, NOW);
		expect(blocks[0].allocatedMinutes).toBeCloseTo(4.2);
	});

	it("uses default 5-min cost when duration unknown", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "maintenance", lastPracticed: days }),
			makePiece({ id: "p2", state: "maintenance", lastPracticed: days }),
		];
		const { blocks, leftoverMinutes } = pickRepertoireMaintenanceBlocks(
			pieces,
			12,
			NOW,
		);
		expect(blocks).toHaveLength(2);
		expect(blocks.every((b) => b.allocatedMinutes === 5)).toBe(true);
		expect(leftoverMinutes).toBe(2);
	});

	it("skips the oversized best piece, takes the next-best that fits", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "big",
				title: "A",
				state: "performance", // ×3 weight → highest score
				lastPracticed: days,
				durationSeconds: 1800, // 30 min → cost 36
			}),
			makePiece({
				id: "small",
				title: "B",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 300, // cost 6
			}),
		];
		// Budget 5, allowance 8: 36 can never fit, 6 can (1 min of inflation).
		const { blocks, leftoverMinutes, inflationMinutes, optIn } =
			pickRepertoireMaintenanceBlocks(pieces, 5, NOW);
		expect(blocks.map((b) => b.pieceId)).toEqual(["small"]);
		expect(leftoverMinutes).toBe(0);
		expect(inflationMinutes).toBeCloseTo(1);
		expect(optIn?.pieceId).toBe("big");
		expect(optIn?.costMinutes).toBeCloseTo(36);
		expect(optIn?.extraMinutes).toBeCloseTo(31);
		expect(optIn?.daysSinceLastPracticed).toBe(5);
	});

	it("takes a piece landing exactly on the allowance", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 400, // cost exactly 8 = budget 5 + cap 3
			}),
		];
		const { blocks, inflationMinutes, optIn } = pickRepertoireMaintenanceBlocks(
			pieces,
			5,
			NOW,
		);
		expect(blocks).toHaveLength(1);
		expect(inflationMinutes).toBeCloseTo(3);
		expect(optIn).toBeNull();
	});

	it("caps the whole group, not each piece", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		// Four 5-min pieces (cost 5 each) against budget 8, allowance 11 → only
		// two fit. Per-piece capping would have let all four in.
		const pieces: Piece[] = ["A", "B", "C", "D"].map((title, i) =>
			makePiece({
				id: `p${i + 1}`,
				title,
				state: "maintenance",
				lastPracticed: days,
			}),
		);
		const { blocks, inflationMinutes, optIn } = pickRepertoireMaintenanceBlocks(
			pieces,
			8,
			NOW,
		);
		expect(blocks).toHaveLength(2);
		expect(inflationMinutes).toBeCloseTo(2);
		// Each piece would fit on its own — merely crowded out is not an offer.
		expect(optIn).toBeNull();
	});

	it("offers an opt-in and stays empty when nothing fits", () => {
		const days = new Date(NOW.getTime() - 30 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				title: "Sonata in G",
				composer: "Someone",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 900, // cost 18
			}),
		];
		const { blocks, leftoverMinutes, inflationMinutes, optIn } =
			pickRepertoireMaintenanceBlocks(pieces, 4, NOW);
		expect(blocks).toEqual([]);
		expect(leftoverMinutes).toBe(4);
		expect(inflationMinutes).toBe(0);
		expect(optIn).toEqual({
			pieceId: "p1",
			title: "Sonata in G",
			subtitle: "Someone",
			costMinutes: 18,
			extraMinutes: 14,
			daysSinceLastPracticed: 30,
		});
	});

	it("offers no opt-in when there is no maintenance budget", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 900,
			}),
		];
		const r = pickRepertoireMaintenanceBlocks(pieces, 0, NOW);
		expect(r.blocks).toEqual([]);
		expect(r.optIn).toBeNull();
		expect(r.leftoverMinutes).toBe(0);
		expect(r.inflationMinutes).toBe(0);
	});

	it("forced pick swaps the whole group and zeroes the leftover", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "big",
				title: "A",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 900, // cost 18
			}),
			makePiece({
				id: "small",
				title: "B",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 150, // cost 3
			}),
		];
		const { blocks, leftoverMinutes, inflationMinutes, optIn } =
			pickRepertoireMaintenanceBlocks(pieces, 4, NOW, undefined, {
				forcedMaintenancePieceId: "big",
			});
		expect(blocks.map((b) => b.pieceId)).toEqual(["big"]);
		expect(blocks[0].allocatedMinutes).toBeCloseTo(18);
		expect(leftoverMinutes).toBe(0);
		expect(inflationMinutes).toBeCloseTo(14);
		expect(optIn).toBeNull();
	});

	it("ignores a forced pick that is no longer eligible", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "gone",
				state: "learning", // wrong state → not in the pool
				lastPracticed: days,
			}),
			makePiece({
				id: "p2",
				state: "maintenance",
				lastPracticed: days,
			}),
		];
		const { blocks } = pickRepertoireMaintenanceBlocks(
			pieces,
			10,
			NOW,
			undefined,
			{ forcedMaintenancePieceId: "gone" },
		);
		expect(blocks.map((b) => b.pieceId)).toEqual(["p2"]);
	});

	it("packs deterministically for the same inputs", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = ["C", "A", "B"].map((title, i) =>
			makePiece({
				id: `p${i + 1}`,
				title,
				state: "maintenance",
				lastPracticed: days,
			}),
		);
		// Budget 10, allowance 13 → two of the three 5-min pieces fit.
		const a = pickRepertoireMaintenanceBlocks(pieces, 10, NOW);
		const b = pickRepertoireMaintenanceBlocks(pieces, 10, NOW);
		expect(a.blocks.map((x) => x.pieceId)).toEqual(
			b.blocks.map((x) => x.pieceId),
		);
		// Equal scores → title ASC.
		expect(a.blocks.map((x) => x.title)).toEqual(["A", "B"]);
	});

	it("respects usedPieceIds (no double-pick)", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "maintenance", lastPracticed: days }),
			makePiece({ id: "p2", state: "maintenance", lastPracticed: days }),
		];
		const used = new Set<string>(["p1"]);
		const { blocks } = pickRepertoireMaintenanceBlocks(pieces, 30, NOW, used);
		expect(blocks.map((b) => b.pieceId)).toEqual(["p2"]);
	});

	it("exact-fit consumes the whole budget with no leftover", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "maintenance", lastPracticed: days }),
			makePiece({ id: "p2", state: "maintenance", lastPracticed: days }),
		];
		const { blocks, leftoverMinutes } = pickRepertoireMaintenanceBlocks(
			pieces,
			10,
			NOW,
		);
		expect(blocks).toHaveLength(2);
		expect(leftoverMinutes).toBe(0);
	});
});

describe("redistributeForAvailability", () => {
	function alloc(over: Partial<SlotMinutes> = {}): SlotMinutes {
		return {
			technique: 0,
			sightReading: 0,
			repertoireLearning: 0,
			repertoireStabilizing: 0,
			repertoireMaintenance: 0,
			...over,
		};
	}
	function avail(over: Partial<SlotAvailability> = {}): SlotAvailability {
		return {
			technique: true,
			sightReading: true,
			repertoireLearning: true,
			repertoireStabilizing: true,
			repertoireMaintenance: true,
			...over,
		};
	}

	it("worked example: tech10/read5/rep15, 5 freed proportionally, sum conserved", () => {
		const a = alloc({
			technique: 10,
			sightReading: 5,
			repertoireLearning: 15,
			repertoireMaintenance: 5,
		});
		const v = avail({ repertoireMaintenance: false });
		const r = redistributeForAvailability(a, v);
		// 5 freed over a 30-min base → exact 1/3 : 1/6 : 1/2 shares.
		expect(r.technique).toBeCloseTo(10 + 5 / 3);
		expect(r.sightReading).toBeCloseTo(5 + 5 / 6);
		expect(r.repertoireLearning).toBeCloseTo(15 + 2.5);
		expect(r.repertoireMaintenance).toBe(0);
		const total =
			r.technique +
			r.sightReading +
			r.repertoireLearning +
			r.repertoireStabilizing +
			r.repertoireMaintenance;
		expect(total).toBeCloseTo(35);
	});

	it("single empty slot spreads across the rest", () => {
		const a = alloc({ technique: 10, repertoireLearning: 10 });
		const v = avail({ repertoireLearning: false });
		const r = redistributeForAvailability(a, v);
		expect(r.technique).toBe(20);
		expect(r.repertoireLearning).toBe(0);
	});

	it("multiple empty slots pool together", () => {
		const a = alloc({
			technique: 4,
			sightReading: 6,
			repertoireLearning: 10,
		});
		const v = avail({ technique: false, sightReading: false });
		const r = redistributeForAvailability(a, v);
		expect(r.technique).toBe(0);
		expect(r.sightReading).toBe(0);
		expect(r.repertoireLearning).toBe(20);
	});

	it("technique-empty spreads cross-domain into repertoire + reading", () => {
		const a = alloc({
			technique: 6,
			sightReading: 6,
			repertoireLearning: 6,
		});
		const v = avail({ technique: false });
		const r = redistributeForAvailability(a, v);
		expect(r.technique).toBe(0);
		// 6 freed split proportionally across read(6)+learning(6): 3 + 3
		expect(r.sightReading).toBeCloseTo(9);
		expect(r.repertoireLearning).toBeCloseTo(9);
	});

	it("all repertoire empty → minutes go to technique + reading", () => {
		const a = alloc({
			technique: 5,
			sightReading: 5,
			repertoireLearning: 5,
			repertoireStabilizing: 5,
		});
		const v = avail({
			repertoireLearning: false,
			repertoireStabilizing: false,
		});
		const r = redistributeForAvailability(a, v);
		expect(r.repertoireLearning).toBe(0);
		expect(r.repertoireStabilizing).toBe(0);
		expect(r.technique + r.sightReading).toBeCloseTo(20);
	});

	it("no recipients → freed minutes dropped", () => {
		const a = alloc({ technique: 10 });
		const v = avail({ technique: false });
		const r = redistributeForAvailability(a, v);
		expect(r.technique).toBe(0);
		const total =
			r.technique +
			r.sightReading +
			r.repertoireLearning +
			r.repertoireStabilizing +
			r.repertoireMaintenance;
		expect(total).toBe(0);
	});

	it("no change when everything is available", () => {
		const a = alloc({ technique: 7, sightReading: 4, repertoireLearning: 19 });
		const r = redistributeForAvailability(a, avail());
		expect(r).toEqual(a);
	});
});

describe("pickTechnique", () => {
	it("count = 1 for slot 5-9 min", () => {
		const t = makeTechnique({ id: "t1", state: "active" });
		const blocks = pickTechnique(7, [t], NOW);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].allocatedMinutes).toBe(7);
	});

	it("count = 2 for slot 10-14 min, 1 maintenance + 1 active", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({ id: "a2", state: "active" }),
			makeTechnique({ id: "m1", state: "maintenance" as TechniqueState }),
		];
		const blocks = pickTechnique(10, ts, NOW);
		expect(blocks).toHaveLength(2);
		// One active + one maintenance
		const ids = blocks.map((b) => b.techniqueId).sort();
		expect(ids).toContain("m1");
	});

	it("count = 3 for slot ≥ 15 min: 1-2 maintenance allowed", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({ id: "a2", state: "active" }),
			makeTechnique({ id: "m1", state: "maintenance" as TechniqueState }),
			makeTechnique({ id: "m2", state: "maintenance" as TechniqueState }),
		];
		const blocks = pickTechnique(15, ts, NOW);
		expect(blocks).toHaveLength(3);
	});

	it("returns empty when both pools empty", () => {
		expect(pickTechnique(10, [], NOW)).toEqual([]);
	});

	it("all from maintenance when active empty", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "m1", state: "maintenance" as TechniqueState }),
		];
		const blocks = pickTechnique(7, ts, NOW);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].techniqueId).toBe("m1");
	});

	it("divides minutes evenly with remainder to first", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({ id: "a2", state: "active" }),
		];
		const blocks = pickTechnique(11, ts, NOW);
		expect(blocks).toHaveLength(2);
		expect(blocks[0].allocatedMinutes + blocks[1].allocatedMinutes).toBe(11);
	});

	it("enforces 3-min floor by reducing count", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({ id: "a2", state: "active" }),
			makeTechnique({ id: "a3", state: "active" }),
		];
		// Slot 5 with count=3 would be 1 min each → reduce
		const blocks = pickTechnique(5, ts, NOW);
		expect(blocks.length).toBeLessThanOrEqual(1);
	});

	it("scores active state higher than maintenance per day", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "active1",
				state: "active",
				title: "A",
				lastPracticedAt: new Date(NOW.getTime() - 1 * 86400000),
			}),
			makeTechnique({
				id: "maint1",
				state: "maintenance" as TechniqueState,
				title: "B",
				lastPracticedAt: new Date(NOW.getTime() - 1 * 86400000),
			}),
		];
		const blocks = pickTechnique(7, ts, NOW);
		expect(blocks[0].techniqueId).toBe("active1");
	});

	it("tie-breaks technique by dateIntroduced ASC then title ASC", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				title: "B",
				state: "active",
				lastPracticedAt: null,
				dateIntroduced: new Date("2026-01-02"),
			}),
			makeTechnique({
				id: "t2",
				title: "A",
				state: "active",
				lastPracticedAt: null,
				dateIntroduced: new Date("2026-01-01"),
			}),
		];
		const blocks = pickTechnique(5, ts, NOW);
		expect(blocks[0].techniqueId).toBe("t2");
	});
});

describe("pickWarmup", () => {
	it("picks LNP maintenance technique", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "m1",
				state: "maintenance" as TechniqueState,
				lastPracticedAt: new Date(NOW.getTime() - 30 * 86400000),
			}),
			makeTechnique({
				id: "m2",
				state: "maintenance" as TechniqueState,
				lastPracticedAt: new Date(NOW.getTime() - 5 * 86400000),
			}),
		];
		const b = pickWarmup(ts, 5, NOW);
		expect(b.techniqueId).toBe("m1");
	});

	it("returns block with no technique when no maintenance available", () => {
		const b = pickWarmup([], 5, NOW);
		expect(b.techniqueId).toBeNull();
		expect(b.kind).toBe("warmup");
	});
});

describe("planned block modeKey", () => {
	it("carries the technique mode that earned the block", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				state: "active",
				handsMode: "separate",
				activeDrills: ["staccato"],
				byMode: {
					LH: { bpm: 90, quality: 5, effort: 1, lastPracticed: NOW },
					"LH.staccato": {
						bpm: 40,
						quality: 2,
						effort: 5,
						lastPracticed: new Date(NOW.getTime() - 10 * 86400000),
					},
				},
			}),
		];
		const blocks = pickTechnique(7, ts, NOW);
		expect(blocks[0].modeKey).toBe("LH.staccato");
	});

	it("is null for a technique with no mode history", () => {
		const ts: TechniqueItem[] = [makeTechnique({ id: "t1", state: "active" })];
		expect(pickTechnique(7, ts, NOW)[0].modeKey).toBeNull();
	});

	it("drops a mode the technique can no longer reach", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				state: "active",
				handsMode: "separate",
				// Drill turned off — its stale stats must not drive the preselect.
				activeDrills: [],
				byMode: {
					LH: {
						bpm: 90,
						quality: 5,
						effort: 1,
						lastPracticed: new Date(NOW.getTime() - 1 * 86400000),
					},
					"LH.staccato": {
						bpm: 40,
						quality: 2,
						effort: 5,
						lastPracticed: new Date(NOW.getTime() - 10 * 86400000),
					},
				},
			}),
		];
		expect(pickTechnique(7, ts, NOW)[0].modeKey).toBe("LH");
	});

	it("carries the section mode that earned the block", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "learning", targetTempoBpm: 100 }),
		];
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				byMode: {
					LH: {
						bpm: 30,
						quality: 2,
						effort: 5,
						lastPracticed: new Date(NOW.getTime() - 1 * 86400000),
					},
					RH: {
						bpm: 110,
						quality: 5,
						effort: 1,
						lastPracticed: new Date(NOW.getTime() - 1 * 86400000),
					},
				},
			}),
		];
		const b = pickRepertoireSection("learning", pieces, sections, 10, NOW);
		expect(b?.modeKey).toBe("LH");
	});

	it("carries the warmup technique's neediest mode", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "m1",
				state: "maintenance" as TechniqueState,
				lastPracticedAt: new Date(NOW.getTime() - 30 * 86400000),
				handsMode: "both",
				byMode: {
					HT: { bpm: 90, quality: 5, effort: 1, lastPracticed: NOW },
					LH: {
						bpm: 50,
						quality: 2,
						effort: 5,
						lastPracticed: new Date(NOW.getTime() - 30 * 86400000),
					},
				},
			}),
		];
		expect(pickWarmup(ts, 5, NOW).modeKey).toBe("LH");
	});
});

describe("buildPlan", () => {
	it("orders blocks canonically — reading directly after warmup", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "learning" }),
			makePiece({ id: "p2", state: "stabilizing" }),
			makePiece({ id: "p3", state: "maintenance" }),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(alloc(), pieces, [], ts, NOW);
		const kinds = plan.blocks.map((b) => b.kind);
		expect(kinds[0]).toBe("sight-reading");
		expect(kinds[1]).toBe("technique");
		expect(kinds[2]).toBe("repertoire-learning");
		expect(kinds[3]).toBe("repertoire-stabilizing");
		expect(kinds[4]).toBe("repertoire-maintenance");
	});

	it("includes warmup when the allocation funds it", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({
				id: "m1",
				state: "maintenance" as TechniqueState,
			}),
		];
		const plan = buildPlan(BALANCED_60, pieces, [], ts, NOW);
		expect(plan.blocks[0].kind).toBe("warmup");
	});

	it("omits sight-reading block when allocation is 0", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(alloc({ sightReading: 0 }), pieces, [], [], NOW);
		expect(plan.blocks.find((b) => b.kind === "sight-reading")).toBeUndefined();
	});

	it("drops technique block when no techniques available", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(alloc(), pieces, [], [], NOW);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeUndefined();
	});

	it("redistributes when no learning pieces", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p2", state: "stabilizing" }),
			makePiece({ id: "p3", state: "maintenance" }),
		];
		const plan = buildPlan(alloc(), pieces, [], [], NOW);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-learning"),
		).toBeUndefined();
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-stabilizing"),
		).toBeDefined();
	});

	it("deterministic: same allocation → same plan", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const p1 = buildPlan(alloc(), pieces, [], ts, NOW);
		const p2 = buildPlan(alloc(), pieces, [], ts, NOW);
		expect(p2.blocks.map((b) => b.kind)).toEqual(p1.blocks.map((b) => b.kind));
		expect(p2.blocks.map((b) => b.pieceId)).toEqual(
			p1.blocks.map((b) => b.pieceId),
		);
	});

	it("derives totalMinutes from the allocation", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			alloc({ warmup: 3, sightReading: 5, technique: 6 }),
			pieces,
			[],
			ts,
			NOW,
		);
		expect(plan.totalMinutes).toBeCloseTo(3 + 5 + 6 + 10.45 + 5.7 + 2.85);
	});

	it("carries the preset identity onto the plan", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(alloc(), pieces, [], [], NOW, {
			presetId: "preset-1",
			presetName: "Weekday quick",
		});
		expect(plan.presetId).toBe("preset-1");
		expect(plan.presetName).toBe("Weekday quick");
	});

	it("marks a Custom session with a null presetId", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(alloc(), pieces, [], [], NOW, {
			presetName: "Custom",
		});
		expect(plan.presetId).toBeNull();
		expect(plan.presetName).toBe("Custom");
	});

	it("a repertoire-heavy allocation still schedules its technique and reading minutes", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1", phase: "learning", order: 1 }),
			makeSection({ id: "s0", pieceId: "p1", phase: "stabilizing", order: 0 }),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			alloc({
				sightReading: 5,
				technique: 5,
				repertoireLearning: 12,
				repertoireStabilizing: 5,
				repertoireMaintenance: 3,
			}),
			pieces,
			sections,
			ts,
			NOW,
		);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeDefined();
		expect(plan.blocks.find((b) => b.kind === "sight-reading")).toBeDefined();
		// Repertoire still dominates the plan.
		const repMinutes = plan.blocks
			.filter((b) => b.kind.startsWith("repertoire"))
			.reduce((acc, b) => acc + b.allocatedMinutes, 0);
		expect(repMinutes).toBeGreaterThan(15);
	});

	it("an allocation with no repertoire minutes produces no repertoire blocks", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "learning" }),
			makePiece({ id: "p2", state: "maintenance" }),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			alloc({
				sightReading: 11,
				technique: 19,
				repertoireLearning: 0,
				repertoireStabilizing: 0,
				repertoireMaintenance: 0,
			}),
			pieces,
			[],
			ts,
			NOW,
		);
		expect(plan.blocks.some((b) => b.kind.startsWith("repertoire"))).toBe(
			false,
		);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeDefined();
		expect(plan.blocks.find((b) => b.kind === "sight-reading")).toBeDefined();
	});

	it("keeps reading before technique even when technique dominates", () => {
		// Reading is never last: tired reading is guessing, and guessing is the
		// reflex it trains. The order does not follow the minutes.
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			alloc({ warmup: 3, sightReading: 5, technique: 13 }),
			pieces,
			[],
			ts,
			NOW,
		);
		const kinds = plan.blocks.map((b) => b.kind);
		expect(kinds[0]).toBe("warmup");
		expect(kinds.indexOf("sight-reading")).toBeLessThan(
			kinds.indexOf("technique"),
		);
	});

	it("after practicing, next session picks stalest content (regression: same picks across sessions)", () => {
		// Two learning pieces, two techniques. Session 1 picks the stalest.
		// After session 1 updates lastPracticed, session 2 (next day) picks the OTHER items.
		const session1Day = new Date("2026-05-27T12:00:00Z");
		const session2Day = new Date("2026-05-28T12:00:00Z"); // next day

		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				title: "A",
				state: "learning",
				lastPracticed: null, // never practiced → score = 10 × 999
			}),
			makePiece({
				id: "p2",
				title: "B",
				state: "learning",
				lastPracticed: new Date("2026-05-20T12:00:00Z"), // 7 days stale
			}),
		];
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				title: "T1",
				state: "active",
				lastPracticedAt: null, // never → score = 10 × 999
			}),
			makeTechnique({
				id: "t2",
				title: "T2",
				state: "active",
				lastPracticedAt: new Date("2026-05-20T12:00:00Z"), // 7 days stale
			}),
		];

		// Session 1: picks p1 (never practiced, higher score) and t1 (never practiced)
		const plan1 = buildPlan(
			alloc({ sightReading: 0 }),
			pieces,
			[],
			ts,
			session1Day,
		);
		const plan1Piece = plan1.blocks.find(
			(b) => b.kind === "repertoire-learning",
		);
		const plan1Tech = plan1.blocks.find((b) => b.kind === "technique");
		expect(plan1Piece?.pieceId).toBe("p1"); // p1 wins (999 days > 7 days)
		expect(plan1Tech?.techniqueId).toBe("t1"); // t1 wins (999 days > 7 days)

		// Simulate session 1 completing: update lastPracticed for p1 and t1
		const afterSession1Pieces: Piece[] = [
			makePiece({
				id: "p1",
				title: "A",
				state: "learning",
				lastPracticed: session1Day, // just practiced
			}),
			makePiece({
				id: "p2",
				title: "B",
				state: "learning",
				lastPracticed: new Date("2026-05-20T12:00:00Z"), // 8 days stale now
			}),
		];
		const afterSession1Techniques: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				title: "T1",
				state: "active",
				lastPracticedAt: session1Day, // just practiced
			}),
			makeTechnique({
				id: "t2",
				title: "T2",
				state: "active",
				lastPracticedAt: new Date("2026-05-20T12:00:00Z"), // 8 days stale now
			}),
		];

		// Session 2 (next day): p2 and t2 should now score higher
		const plan2 = buildPlan(
			alloc({ sightReading: 0 }),
			afterSession1Pieces,
			[],
			afterSession1Techniques,
			session2Day,
		);
		const plan2Piece = plan2.blocks.find(
			(b) => b.kind === "repertoire-learning",
		);
		const plan2Tech = plan2.blocks.find((b) => b.kind === "technique");
		expect(plan2Piece?.pieceId).toBe("p2"); // p2 wins (8 days stale > 1 day)
		expect(plan2Tech?.techniqueId).toBe("t2"); // t2 wins (8 days stale > 1 day)
	});

	it("emits multiple maintenance blocks packed by duration", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "learning" }),
			...["m1", "m2", "m3", "m4"].map((id) =>
				makePiece({
					id,
					title: id.toUpperCase(),
					state: "maintenance",
					lastPracticed: days,
					durationSeconds: 60, // cost 1 × 1.2 = 1.2
				}),
			),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(BALANCED_60, pieces, [], ts, NOW);
		const maint = plan.blocks.filter(
			(b) => b.kind === "repertoire-maintenance",
		);
		expect(maint.length).toBeGreaterThanOrEqual(2);
		expect(maint.every((b) => Math.abs(b.allocatedMinutes - 1.2) < 1e-9)).toBe(
			true,
		);
		expect(plan.inflationMinutes).toBe(0);
		expect(plan.maintenanceOptIn).toBeNull();
	});

	it("maintenance leftover fills the section blocks up to their caps", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "pl", state: "learning" }),
			makePiece({ id: "ps", state: "stabilizing" }),
			makePiece({
				id: "pm",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 60, // cost 1.2 of a 5.25-min maintenance budget
			}),
		];
		const sections: Section[] = [
			makeSection({ id: "l1", pieceId: "pl", phase: "learning", order: 1 }),
			makeSection({ id: "r1", pieceId: "pl", phase: "stabilizing", order: 0 }),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(BALANCED_60, pieces, sections, ts, NOW);
		// 60 balanced: rep 35 → learning 19.25, stabilizing 10.5, maintenance 5.25.
		// The learning line wants 2 × 8 + 3.25 review but has one learning section,
		// so it collapses to 12 learning + 7.25 review. Maintenance leaves 4.05
		// over, which tops up review (→ 8) and stabilizing (→ 12) to their caps;
		// the remaining 1.8 lands on the freeform reading timer.
		const learn = plan.blocks.find((b) => b.kind === "repertoire-learning");
		const review = plan.blocks.find((b) => b.kind === "repertoire-review");
		const stab = plan.blocks.find((b) => b.kind === "repertoire-stabilizing");
		const sight = plan.blocks.find((b) => b.kind === "sight-reading");
		expect(learn?.allocatedMinutes).toBeCloseTo(12);
		expect(review?.allocatedMinutes).toBeCloseTo(8);
		expect(stab?.allocatedMinutes).toBeCloseTo(12);
		expect(sight?.allocatedMinutes).toBeCloseTo(9.8);
		// Nothing overran and nothing was dropped → still exactly 60.
		const total = plan.blocks.reduce((acc, b) => acc + b.allocatedMinutes, 0);
		expect(total).toBeCloseTo(60);
		expect(plan.inflationMinutes).toBe(0);
	});

	it("inflates by at most the cap and reports it on the plan", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "pl", state: "learning" }),
			makePiece({ id: "ps", state: "stabilizing" }),
			makePiece({
				id: "pm",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 300, // cost 6 against a 2.85-min budget
			}),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		// 30 balanced: rep 19 → maintenance 2.85, allowance 5.85. Cost 6 > 5.85.
		const plan = buildPlan(alloc(), pieces, [], ts, NOW);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-maintenance"),
		).toBeUndefined();
		expect(plan.inflationMinutes).toBe(0);
		expect(plan.maintenanceOptIn?.pieceId).toBe("pm");
		// The unusable maintenance minutes went to learning/stabilizing instead.
		const total = plan.blocks.reduce((acc, b) => acc + b.allocatedMinutes, 0);
		expect(total).toBeCloseTo(30);
		expect(planTotalMinutes(plan)).toBe(30);
	});

	it("forced opt-in rebuilds the plan and reclaims the leftover", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "pl", state: "learning" }),
			makePiece({ id: "ps", state: "stabilizing" }),
			makePiece({
				id: "pm",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 300, // cost 6
			}),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(alloc(), pieces, [], ts, NOW, {
			forcedMaintenancePieceId: "pm",
		});
		const maint = plan.blocks.filter(
			(b) => b.kind === "repertoire-maintenance",
		);
		expect(maint.map((b) => b.pieceId)).toEqual(["pm"]);
		expect(maint[0].allocatedMinutes).toBeCloseTo(6);
		expect(plan.maintenanceOptIn).toBeNull();
		// Maintenance budget was 2.85 → 6 costs 3.15 more than requested.
		expect(plan.inflationMinutes).toBeCloseTo(3.15);
		expect(planTotalMinutes(plan)).toBeCloseTo(33.15);
		const total = plan.blocks.reduce((acc, b) => acc + b.allocatedMinutes, 0);
		expect(total).toBeCloseTo(33.15);
	});

	it("puts the review block before the learning blocks it warms into", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({
				id: "learn",
				pieceId: "p1",
				phase: "learning",
				order: 1,
				lastPracticed: days,
			}),
			makeSection({
				id: "learned",
				pieceId: "p1",
				phase: "stabilizing",
				order: 0,
				lastPracticed: days,
			}),
		];
		const plan = buildPlan(BALANCED_60, pieces, sections, [], NOW);
		const kinds = plan.blocks.map((b) => b.kind);
		expect(kinds.indexOf("repertoire-review")).toBeGreaterThanOrEqual(0);
		expect(kinds.indexOf("repertoire-review")).toBeLessThan(
			kinds.indexOf("repertoire-learning"),
		);
		// The stabilizing-phase section inside a learning piece — previously
		// unreachable by any line — is what the review block lands on.
		const review = plan.blocks.find((b) => b.kind === "repertoire-review");
		expect(review?.sectionId).toBe("learned");
	});

	it("does not schedule a piece twice when its problem section takes the stabilizing line", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "pl", state: "learning" }),
			makePiece({
				id: "pm",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 120,
			}),
		];
		const sections: Section[] = [
			makeSection({
				id: "problem",
				pieceId: "pm",
				phase: "stabilizing",
				lastPracticed: days,
			}),
		];
		const plan = buildPlan(BALANCED_60, pieces, sections, [], NOW);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-stabilizing")?.sectionId,
		).toBe("problem");
		expect(
			plan.blocks.filter((b) => b.pieceId === "pm").map((b) => b.kind),
		).toEqual(["repertoire-stabilizing"]);
	});

	it("records the learning minutes no block could take", () => {
		// One learning section, nothing learned yet to review, and no other line
		// to absorb the surplus — the preview has to say where the minutes went.
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1", phase: "learning" }),
		];
		const plan = buildPlan(
			alloc({
				sightReading: 0,
				technique: 0,
				repertoireLearning: 20,
				repertoireStabilizing: 0,
				repertoireMaintenance: 0,
			}),
			pieces,
			sections,
			[],
			NOW,
		);
		const learning = plan.blocks.filter(
			(b) => b.kind === "repertoire-learning",
		);
		expect(learning).toHaveLength(1);
		expect(learning[0].allocatedMinutes).toBeCloseTo(12);
		const om = plan.omitted?.find((o) => o.kind === "repertoire-review");
		expect(om?.reason).toBe("no-content");
		expect(om?.redistributedMinutes).toBeCloseTo(8);
	});

	it("says the review half came up empty when its sections were used today", () => {
		const NOW_LOCAL = new Date(2026, 4, 27, 12, 0);
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1", phase: "learning" }),
			makeSection({
				id: "r1",
				pieceId: "p1",
				phase: "stabilizing",
				lastPracticed: new Date(NOW_LOCAL.getTime() - 60 * 60 * 1000),
			}),
		];
		const plan = buildPlan(
			alloc({
				sightReading: 0,
				technique: 0,
				repertoireLearning: 20,
				repertoireStabilizing: 0,
				repertoireMaintenance: 0,
			}),
			pieces,
			sections,
			[],
			NOW_LOCAL,
		);
		const om = plan.omitted?.find((o) => o.kind === "repertoire-review");
		expect(om?.reason).toBe("practiced-today");
		expect(om?.redistributedMinutes).toBeCloseTo(8);
	});

	it("drops maintenance leftover when no learning/stabilizing blocks exist", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "m1",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 60,
			}),
			makePiece({
				id: "m2",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 60,
			}),
		];
		const plan = buildPlan(
			alloc({
				sightReading: 0,
				technique: 0,
				repertoireLearning: 16.5,
				repertoireStabilizing: 9,
				repertoireMaintenance: 4.5,
			}),
			pieces,
			[],
			[],
			NOW,
		);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-learning"),
		).toBeUndefined();
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-stabilizing"),
		).toBeUndefined();
		const maint = plan.blocks.filter(
			(b) => b.kind === "repertoire-maintenance",
		);
		expect(maint.length).toBeGreaterThanOrEqual(1);
		// Leftover dropped → session runs short (2 pieces × 1 min ≪ 30).
		const totalAllocated = plan.blocks.reduce(
			(acc, b) => acc + b.allocatedMinutes,
			0,
		);
		expect(totalAllocated).toBeLessThan(30);
	});
});

describe("same-day exclusion", () => {
	const NOW_LOCAL = new Date(2026, 4, 27, 12, 0); // local noon

	function oneHourAgo(): Date {
		return new Date(NOW_LOCAL.getTime() - 60 * 60 * 1000);
	}

	function twoDaysAgo(): Date {
		return new Date(NOW_LOCAL.getTime() - 2 * 86400000);
	}

	it("excludes section practiced earlier today from learning slot", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", title: "A", state: "learning" }),
			makePiece({ id: "p2", title: "B", state: "learning" }),
		];
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: oneHourAgo(),
			}),
			makeSection({
				id: "s2",
				pieceId: "p2",
				phase: "learning",
				lastPracticed: twoDaysAgo(),
			}),
		];
		const block = pickRepertoireSection(
			"learning",
			pieces,
			sections,
			10,
			NOW_LOCAL,
		);
		expect(block?.sectionId).toBe("s2");
	});

	it("keeps a section whose other hand is still unpractised today", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", title: "A", state: "learning" }),
		];
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: oneHourAgo(),
				byMode: {
					LH: { bpm: 100, lastPracticed: oneHourAgo() },
					RH: { bpm: 100, lastPracticed: twoDaysAgo() },
				},
			}),
		];
		const block = pickRepertoireSection(
			"learning",
			pieces,
			sections,
			10,
			NOW_LOCAL,
		);
		expect(block?.sectionId).toBe("s1");
	});

	it("excludes a section whose every mode was practiced today", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", title: "A", state: "learning" }),
		];
		const sections: Section[] = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: oneHourAgo(),
				byMode: {
					LH: { bpm: 100, lastPracticed: oneHourAgo() },
					RH: { bpm: 100, lastPracticed: oneHourAgo() },
				},
			}),
		];
		const block = pickRepertoireSection(
			"learning",
			pieces,
			sections,
			10,
			NOW_LOCAL,
		);
		expect(block).toBeNull();
	});

	it("keeps a technique whose other hand is still unpractised today", () => {
		const techniques: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				state: "active",
				lastPracticedAt: oneHourAgo(),
				byMode: {
					LH: { lastPracticed: oneHourAgo() },
					RH: { lastPracticed: twoDaysAgo() },
				},
			}),
		];
		const blocks = pickTechnique(10, techniques, NOW_LOCAL);
		expect(blocks[0]?.techniqueId).toBe("t1");
	});

	it("excludes piece practiced earlier today from maintenance slot", () => {
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				title: "A",
				state: "maintenance",
				lastPracticed: oneHourAgo(),
			}),
			makePiece({
				id: "p2",
				title: "B",
				state: "maintenance",
				lastPracticed: twoDaysAgo(),
			}),
		];
		const { blocks } = pickRepertoireMaintenanceBlocks(pieces, 5, NOW_LOCAL);
		expect(blocks[0]?.pieceId).toBe("p2");
	});

	it("excludes technique practiced earlier today", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				state: "active",
				lastPracticedAt: oneHourAgo(),
			}),
			makeTechnique({
				id: "t2",
				state: "active",
				lastPracticedAt: twoDaysAgo(),
			}),
		];
		const blocks = pickTechnique(7, ts, NOW_LOCAL);
		expect(blocks[0].techniqueId).toBe("t2");
	});

	it("warmup excludes maintenance technique practiced today; falls back to freeform if none left", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "m1",
				state: "maintenance",
				lastPracticedAt: oneHourAgo(),
			}),
		];
		const b = pickWarmup(ts, 5, NOW_LOCAL);
		expect(b.techniqueId).toBeNull();
	});

	it("respects usedTechniqueIds for cross-block dedup", () => {
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "t1",
				state: "active",
				lastPracticedAt: twoDaysAgo(),
			}),
			makeTechnique({
				id: "t2",
				state: "active",
				lastPracticedAt: twoDaysAgo(),
			}),
		];
		const used = new Set<string>(["t1"]);
		const blocks = pickTechnique(7, ts, NOW_LOCAL, used);
		expect(blocks[0].techniqueId).toBe("t2");
	});

	it("buildPlan: warmup and technique pick different techniques in 60-min session", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "a1",
				state: "active",
				lastPracticedAt: twoDaysAgo(),
			}),
			makeTechnique({
				id: "m1",
				state: "maintenance",
				lastPracticedAt: twoDaysAgo(),
			}),
			makeTechnique({
				id: "m2",
				state: "maintenance",
				lastPracticedAt: twoDaysAgo(),
			}),
		];
		const plan = buildPlan(BALANCED_60, pieces, [], ts, NOW_LOCAL);
		const warmup = plan.blocks.find((b) => b.kind === "warmup");
		const techBlocks = plan.blocks.filter((b) => b.kind === "technique");
		const warmupId = warmup?.techniqueId;
		expect(warmupId).not.toBeNull();
		for (const tb of techBlocks) {
			expect(tb.techniqueId).not.toBe(warmupId);
		}
	});

	it("buildPlan: omitted entry with reason=practiced-today when all techniques used today", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [
			makeTechnique({
				id: "a1",
				state: "active",
				lastPracticedAt: oneHourAgo(),
			}),
		];
		const plan = buildPlan(alloc(), pieces, [], ts, NOW_LOCAL);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeUndefined();
		const om = plan.omitted?.find((o) => o.kind === "technique");
		expect(om?.reason).toBe("practiced-today");
		expect(om?.redistributedMinutes).toBe(7);
	});

	it("buildPlan: omitted reason=no-content when pool has no techniques at all", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(alloc(), pieces, [], [], NOW_LOCAL);
		const om = plan.omitted?.find((o) => o.kind === "technique");
		expect(om?.reason).toBe("no-content");
	});

	it("buildPlan: redistribution when learning pool empty due to today-exclusion", () => {
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "learning",
				lastPracticed: oneHourAgo(),
			}),
			makePiece({
				id: "p2",
				state: "stabilizing",
				lastPracticed: twoDaysAgo(),
			}),
		];
		const plan = buildPlan(alloc(), pieces, [], [], NOW_LOCAL);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-learning"),
		).toBeUndefined();
		const om = plan.omitted?.find((o) => o.kind === "repertoire-learning");
		expect(om?.reason).toBe("practiced-today");
	});
});
