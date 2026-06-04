import type { PieceState } from "@/models/piece";
import type { Section } from "@/models/section";
import type { TechniqueState } from "@/models/technique";
import { suggestPieces, suggestTechniques } from "./overview-suggestions";
import { makePiece, makeSection, makeTechnique } from "./test-factories";

const NOW = new Date("2026-05-27T12:00:00Z");
const TODAY = new Date(NOW.getTime() - 30 * 60 * 1000); // 30 min ago = today
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 86_400_000);

describe("suggestPieces", () => {
	describe("empty state variants", () => {
		it("returns noActivePieces when pieces is empty", () => {
			const result = suggestPieces([], [], NOW);
			expect(result.suggestions).toHaveLength(0);
			expect(result.emptyStateKey).toBe(
				"screen.overview.emptyState.noActivePieces",
			);
		});

		it("returns allPracticedToday when all active pieces practiced today", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning", lastPracticed: TODAY }),
				makePiece({ id: "p2", state: "maintenance", lastPracticed: TODAY }),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions).toHaveLength(0);
			expect(result.emptyStateKey).toBe(
				"screen.overview.emptyState.allPracticedToday",
			);
		});

		it("returns allMaintenance nudge when all active pieces are maintenance/performance", () => {
			const pieces = [
				makePiece({ id: "p1", state: "maintenance" }),
				makePiece({ id: "p2", state: "performance" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.emptyStateKey).toBe(
				"screen.overview.emptyState.allMaintenance",
			);
		});

		it("ignores on_hold and shelved for allPracticedToday check", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning", lastPracticed: TODAY }),
				makePiece({ id: "p2", state: "on_hold" as PieceState }),
				makePiece({ id: "p3", state: "shelved" as PieceState }),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.emptyStateKey).toBe(
				"screen.overview.emptyState.allPracticedToday",
			);
		});
	});

	describe("cap logic", () => {
		it("max 1 learning piece", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning" }),
				makePiece({ id: "p2", state: "learning" }),
				makePiece({ id: "p3", state: "learning" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const learning = result.suggestions.filter(
				(s) => s.piece.state === "learning",
			);
			expect(learning).toHaveLength(1);
		});

		it("max 1 stabilizing piece", () => {
			const pieces = [
				makePiece({ id: "p1", state: "stabilizing" }),
				makePiece({ id: "p2", state: "stabilizing" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const stab = result.suggestions.filter(
				(s) => s.piece.state === "stabilizing",
			);
			expect(stab).toHaveLength(1);
		});

		it("max 2 performance pieces", () => {
			const pieces = [
				makePiece({ id: "p1", state: "performance" }),
				makePiece({ id: "p2", state: "performance" }),
				makePiece({ id: "p3", state: "performance" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const perf = result.suggestions.filter(
				(s) => s.piece.state === "performance",
			);
			expect(perf).toHaveLength(2);
		});

		it("max 2 maintenance pieces", () => {
			const pieces = [
				makePiece({ id: "p1", state: "maintenance" }),
				makePiece({ id: "p2", state: "maintenance" }),
				makePiece({ id: "p3", state: "maintenance" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const maint = result.suggestions.filter(
				(s) => s.piece.state === "maintenance",
			);
			expect(maint).toHaveLength(2);
		});
	});

	describe("ordering", () => {
		it("learning before stabilizing before performance before maintenance", () => {
			const pieces = [
				makePiece({ id: "m", state: "maintenance" }),
				makePiece({ id: "p", state: "performance" }),
				makePiece({ id: "s", state: "stabilizing" }),
				makePiece({ id: "l", state: "learning" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const states = result.suggestions.map((s) => s.piece.state);
			expect(states).toEqual([
				"learning",
				"stabilizing",
				"performance",
				"maintenance",
			]);
		});

		it("picks highest-scoring learning piece", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning", title: "A" }),
				makePiece({
					id: "p2",
					state: "learning",
					title: "B",
					// never practiced → 999 days, high score
				}),
			];
			// p1 has a section practiced long ago, p2 has no lastPracticed
			const sections: Section[] = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					lastPracticed: TWO_DAYS_AGO,
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].piece.id).toBe("p2");
		});
	});

	describe("reason text", () => {
		it("neverPracticed reason for piece with no lastPracticed", () => {
			const pieces = [makePiece({ id: "p1", state: "learning" })];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.neverPracticed",
			);
		});

		it("bpmGap reason when gap dominates", () => {
			const pieces = [
				makePiece({
					id: "p1",
					state: "maintenance",
					lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
					targetTempoBpm: 120,
					lastAchievedTempoBpm: 10, // gap = 110, stateWeight*days = 1
				}),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.bpmGap",
			);
			expect(result.suggestions[0].reasonParams.gap).toBe(110);
		});

		it("daysSince reason as default", () => {
			const pieces = [
				makePiece({
					id: "p1",
					state: "learning",
					lastPracticed: TWO_DAYS_AGO,
				}),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.daysSince",
			);
			expect(result.suggestions[0].reasonParams.days).toBe(2);
		});
	});

	describe("never-practiced boost", () => {
		it("never-practiced piece scores 999 × phaseScore", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning" }), // 999 days
				makePiece({
					id: "p2",
					state: "learning",
					lastPracticed: TWO_DAYS_AGO,
				}),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions[0].piece.id).toBe("p1");
			expect(result.suggestions[0].score).toBeGreaterThan(
				result.suggestions.length > 1 ? result.suggestions[1].score : 0,
			);
		});
	});

	describe("excludes on_hold and shelved", () => {
		it("omits on_hold pieces from suggestions", () => {
			const pieces = [
				makePiece({ id: "p1", state: "on_hold" as PieceState }),
				makePiece({ id: "p2", state: "learning" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions.every((s) => s.piece.id !== "p1")).toBe(true);
		});
	});

	describe("excludes practiced today", () => {
		it("omits piece practiced today", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning", lastPracticed: TODAY }),
				makePiece({ id: "p2", state: "learning" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions.every((s) => s.piece.id !== "p1")).toBe(true);
		});
	});

	describe("emptyStateKey null when suggestions exist", () => {
		it("null emptyStateKey when learning suggestion present", () => {
			const pieces = [makePiece({ id: "p1", state: "learning" })];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions).toHaveLength(1);
			expect(result.emptyStateKey).toBeNull();
		});
	});
});

describe("suggestTechniques", () => {
	it("returns empty suggestions and null key when no active/maintenance techniques", () => {
		const techs = [
			makeTechnique({ id: "t1", state: "retired" as TechniqueState }),
		];
		const result = suggestTechniques(techs, NOW);
		expect(result.suggestions).toHaveLength(0);
		expect(result.emptyStateKey).toBeNull();
	});

	it("returns allTechniquesPracticedToday when all eligible practiced today", () => {
		const techs = [
			makeTechnique({ id: "t1", state: "active", lastPracticedAt: TODAY }),
			makeTechnique({
				id: "t2",
				state: "maintenance" as TechniqueState,
				lastPracticedAt: TODAY,
			}),
		];
		const result = suggestTechniques(techs, NOW);
		expect(result.suggestions).toHaveLength(0);
		expect(result.emptyStateKey).toBe(
			"screen.overview.emptyState.allTechniquesPracticedToday",
		);
	});

	it("max 2 active + max 2 maintenance", () => {
		const techs = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({ id: "a2", state: "active" }),
			makeTechnique({ id: "a3", state: "active" }),
			makeTechnique({ id: "m1", state: "maintenance" as TechniqueState }),
			makeTechnique({ id: "m2", state: "maintenance" as TechniqueState }),
			makeTechnique({ id: "m3", state: "maintenance" as TechniqueState }),
		];
		const result = suggestTechniques(techs, NOW);
		const active = result.suggestions.filter((s) => s.tech.state === "active");
		const maint = result.suggestions.filter(
			(s) => s.tech.state === "maintenance",
		);
		expect(active).toHaveLength(2);
		expect(maint).toHaveLength(2);
	});

	it("new technique gets neverPracticed reason", () => {
		const techs = [makeTechnique({ id: "t1", state: "active" })];
		const result = suggestTechniques(techs, NOW);
		expect(result.suggestions[0].reasonKey).toBe(
			"screen.overview.techniqueReason.new",
		);
	});

	it("effort/quality dominant reason fires when bonus > stateScore × days", () => {
		const techs = [
			makeTechnique({
				id: "t1",
				state: "active",
				lastPracticedAt: new Date(NOW.getTime() - 86_400_000),
				lastEffort: 5,
				lastQuality: 1,
			}),
		];
		const result = suggestTechniques(techs, NOW);
		expect(result.suggestions[0].reasonKey).toBe(
			"screen.overview.techniqueReason.effortQuality",
		);
	});

	it("daysSince reason as default", () => {
		const techs = [
			makeTechnique({
				id: "t1",
				state: "active",
				lastPracticedAt: new Date(NOW.getTime() - 3 * 86_400_000),
			}),
		];
		const result = suggestTechniques(techs, NOW);
		expect(result.suggestions[0].reasonKey).toBe(
			"screen.overview.techniqueReason.daysSince",
		);
		expect(result.suggestions[0].reasonParams.days).toBe(3);
	});

	it("sorts by score descending within active and maintenance", () => {
		const techs = [
			makeTechnique({
				id: "a1",
				state: "active",
				lastPracticedAt: new Date(NOW.getTime() - 1 * 86_400_000),
			}),
			makeTechnique({
				id: "a2",
				state: "active",
				lastPracticedAt: new Date(NOW.getTime() - 5 * 86_400_000),
			}),
		];
		const result = suggestTechniques(techs, NOW);
		// a2 (5 days) should score higher than a1 (1 day)
		expect(result.suggestions[0].tech.id).toBe("a2");
	});
});
