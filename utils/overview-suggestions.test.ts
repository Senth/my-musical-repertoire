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
		it("max 2 learning pieces", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning" }),
				makePiece({ id: "p2", state: "learning" }),
				makePiece({ id: "p3", state: "learning" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const learning = result.suggestions.filter(
				(s) => s.piece.state === "learning",
			);
			expect(learning).toHaveLength(2);
		});

		it("max 2 stabilizing pieces", () => {
			const pieces = [
				makePiece({ id: "p1", state: "stabilizing" }),
				makePiece({ id: "p2", state: "stabilizing" }),
				makePiece({ id: "p3", state: "stabilizing" }),
			];
			const result = suggestPieces(pieces, [], NOW);
			const stab = result.suggestions.filter(
				(s) => s.piece.state === "stabilizing",
			);
			expect(stab).toHaveLength(2);
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

		it("bpmGap reason when gap dominates for learning piece", () => {
			const pieces = [
				makePiece({
					id: "p1",
					state: "learning",
					lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
					targetTempoBpm: 120,
				}),
			];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
					// gap = 110, phaseScore*days = 10
					byMode: {
						HT: {
							bpm: 10,
							lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
						},
					},
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.bpmGap",
			);
			expect(result.suggestions[0].reasonParams.gap).toBe(110);
		});

		it("mistakes reason when mistakes dominate for maintenance piece", () => {
			const pieces = [
				makePiece({
					id: "p1",
					state: "maintenance",
					lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
					lastTechnicalMistakes: 3, // many
					lastMemoryMistakes: 3, // many → 2*(3+3)=12 > 1*1=1
				}),
			];
			const result = suggestPieces(pieces, [], NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.mistakes",
			);
		});

		it("lastResultPoor reason when quality/effort bonus dominates for maintenance section", () => {
			const pieces = [makePiece({ id: "p1", state: "learning" })];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					phase: "maintenance",
					lastPracticed: new Date(NOW.getTime() - 1 * 86_400_000),
					lastEffort: 5, // bonus = (5-1)+(5-1)=8 > 1*1=1
					lastQuality: 1,
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.lastResultPoor",
			);
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

	describe("breadth-first selection", () => {
		const learningPiece = (id: string) =>
			makePiece({ id, state: "learning", targetTempoBpm: 120 });

		it("suggests two sections of one piece when nothing else is waiting", () => {
			const pieces = [learningPiece("p1")];
			const sections = [
				makeSection({ id: "s1", pieceId: "p1", lastPracticed: TWO_DAYS_AGO }),
				makeSection({ id: "s2", pieceId: "p1", lastPracticed: TWO_DAYS_AGO }),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions.map((s) => s.section?.id)).toEqual([
				"s1",
				"s2",
			]);
		});

		it("gives the second slot to an unrepresented piece, not to a second section", () => {
			// p1 has two never-practised sections, each outscoring p2's only one.
			// Pure score order would hand p1 both slots.
			const pieces = [learningPiece("p1"), learningPiece("p2")];
			const sections = [
				makeSection({ id: "s1", pieceId: "p1" }),
				makeSection({ id: "s2", pieceId: "p1" }),
				makeSection({ id: "s3", pieceId: "p2", lastPracticed: TWO_DAYS_AGO }),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions.map((s) => s.section?.id)).toEqual([
				"s1",
				"s3",
			]);
		});

		it("ranks pieces by their best candidate before taking one each", () => {
			const pieces = [learningPiece("p1"), learningPiece("p2")];
			const sections = [
				makeSection({ id: "s1", pieceId: "p1", lastPracticed: TWO_DAYS_AGO }),
				makeSection({ id: "s2", pieceId: "p2" }), // never practised, wins
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions.map((s) => s.piece.id)).toEqual(["p2", "p1"]);
		});

		it("says everything is practised only once no candidate remains", () => {
			const pieces = [learningPiece("p1")];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					byMode: { HT: { lastPracticed: TODAY } },
				}),
			];
			expect(suggestPieces(pieces, sections, NOW).emptyStateKey).toBe(
				"screen.overview.emptyState.allPracticedToday",
			);

			const partly = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					byMode: { HT: { lastPracticed: TODAY } },
				}),
				makeSection({ id: "s2", pieceId: "p1", lastPracticed: TWO_DAYS_AGO }),
			];
			const result = suggestPieces(pieces, partly, NOW);
			expect(result.emptyStateKey).toBeNull();
			expect(result.suggestions.map((s) => s.section?.id)).toEqual(["s2"]);
		});

		it("keeps a section whose piece was practised today for a mode that was not", () => {
			// The piece-level filter used to hide this; the per-mode one must not.
			const pieces = [
				makePiece({
					id: "p1",
					state: "learning",
					targetTempoBpm: 120,
					lastPracticed: TODAY,
				}),
			];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					lastPracticed: TODAY,
					byMode: {
						LH: { bpm: 90, lastPracticed: TODAY },
						RH: { bpm: 90, lastPracticed: TWO_DAYS_AGO },
					},
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions).toHaveLength(1);
			expect(result.suggestions[0].modeKey).toBe("RH");
			expect(result.suggestions[0].section?.id).toBe("s1");
		});
	});

	describe("the reason follows the winning mode", () => {
		it("counts days from the winning mode, not from the section rollup", () => {
			const pieces = [makePiece({ id: "p1", state: "learning" })];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					lastPracticed: TODAY, // rollup says "today"
					byMode: {
						LH: { lastPracticed: TODAY },
						RH: { lastPracticed: new Date(NOW.getTime() - 5 * 86_400_000) },
					},
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].modeKey).toBe("RH");
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.daysSince",
			);
			expect(result.suggestions[0].reasonParams.days).toBe(5);
		});

		it("measures a hands-separate gap against the hands-separate target", () => {
			const pieces = [
				makePiece({ id: "p1", state: "learning", targetTempoBpm: 120 }),
			];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					lastPracticed: TWO_DAYS_AGO,
					byMode: { LH: { bpm: 10, lastPracticed: TWO_DAYS_AGO } },
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.bpmGap",
			);
			// 120 × 1.15 = 138, not the 120 the rollup would have used.
			expect(result.suggestions[0].reasonParams.gap).toBe(128);
		});

		it("reads quality and effort from the winning mode", () => {
			const pieces = [makePiece({ id: "p1", state: "learning" })];
			const sections = [
				makeSection({
					id: "s1",
					pieceId: "p1",
					phase: "maintenance",
					lastPracticed: new Date(NOW.getTime() - 86_400_000),
					lastQuality: 5, // rollup is clean...
					lastEffort: 1,
					byMode: {
						HT: {
							quality: 1, // ...the mode that scored is not
							effort: 5,
							lastPracticed: new Date(NOW.getTime() - 86_400_000),
						},
					},
				}),
			];
			const result = suggestPieces(pieces, sections, NOW);
			expect(result.suggestions[0].reasonKey).toBe(
				"screen.overview.pieceReason.lastResultPoor",
			);
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
