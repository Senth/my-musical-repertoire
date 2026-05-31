import type { Piece, PieceState } from "@/models/piece";
import type { Section } from "@/models/section";
import type { SessionEmphasis, SessionInputs } from "@/models/session";
import type { TechniqueItem, TechniqueState } from "@/models/technique";
import {
	allocateTime,
	buildPlan,
	pickRepertoireMaintenanceBlocks,
	pickRepertoireSection,
	pickTechnique,
	pickWarmup,
	redistributeForAvailability,
	type SlotAvailability,
	type SlotMinutes,
} from "./session-planner";

function inputs(overrides: Partial<SessionInputs> = {}): SessionInputs {
	return {
		emphasis: "balanced",
		totalMinutes: 30,
		techniqueEnabled: true,
		sightReadingEnabled: true,
		...overrides,
	};
}

function makePiece(
	over: Partial<Piece> & { id: string; title?: string },
): Piece {
	return {
		userId: "u",
		title: over.title ?? `Piece ${over.id}`,
		composer: "C",
		state: "learning",
		targetTempoBpm: null,
		lastPracticed: null,
		lastAchievedTempoBpm: null,
		sectionCount: 0,
		...over,
	};
}

function makeSection(
	over: Partial<Section> & { id: string; pieceId: string },
): Section {
	return {
		userId: "u",
		label: "Sec",
		order: 0,
		phase: "learning",
		archived: false,
		startBar: null,
		endBar: null,
		currentBpm: null,
		targetBpmOverride: null,
		notes: null,
		createdAt: null,
		lastPracticed: null,
		...over,
	};
}

function makeTechnique(
	over: Partial<TechniqueItem> & { id: string; title?: string },
): TechniqueItem {
	return {
		userId: "u",
		title: over.title ?? `T ${over.id}`,
		state: "active",
		type: null,
		targetTempoBpm: null,
		dateIntroduced: new Date("2026-01-01T00:00:00Z"),
		lastPracticedAt: null,
		lastQuality: null,
		lastEffort: null,
		lastAchievedTempoBpm: null,
		...over,
	};
}

const NOW = new Date("2026-05-27T12:00:00Z");

describe("allocateTime", () => {
	const cells: [number, SessionEmphasis, number, number, number, number][] = [
		[15, "balanced", 3, 2, 10, 0],
		[15, "technique-heavy", 6, 0, 9, 0],
		[15, "reading-heavy", 2, 4, 9, 0],
		[15, "repertoire-only", 0, 0, 15, 0],
		[30, "balanced", 7, 4, 19, 0],
		[30, "technique-heavy", 14, 2, 14, 0],
		[30, "reading-heavy", 5, 9, 16, 0],
		[30, "repertoire-only", 0, 0, 30, 0],
		[45, "balanced", 10, 6, 29, 0],
		[45, "technique-heavy", 20, 3, 22, 0],
		[45, "reading-heavy", 7, 13, 25, 0],
		[45, "repertoire-only", 0, 0, 45, 0],
		[60, "balanced", 12, 8, 35, 5],
		[60, "technique-heavy", 23, 4, 28, 5],
		[60, "reading-heavy", 8, 17, 30, 5],
		[60, "repertoire-only", 0, 0, 55, 5],
	];

	it.each(
		cells,
	)("matches reference %i %s", (total, emphasis, tech, read, rep, warmup) => {
		const a = allocateTime(inputs({ totalMinutes: total, emphasis }));
		expect(a.technique).toBe(tech);
		expect(a.sightReading).toBe(read);
		expect(a.repertoireTotal).toBe(rep);
		expect(a.warmup).toBe(warmup);
	});

	it("clamps below 15 to 15", () => {
		const a = allocateTime(inputs({ totalMinutes: 5 }));
		expect(a.technique + a.sightReading + a.repertoireTotal + a.warmup).toBe(
			15,
		);
	});

	it("clamps above 90 to 90", () => {
		const a = allocateTime(inputs({ totalMinutes: 999 }));
		expect(a.technique + a.sightReading + a.repertoireTotal + a.warmup).toBe(
			90,
		);
	});

	it("interpolates 20 min balanced and sums to 20", () => {
		const a = allocateTime(inputs({ totalMinutes: 20 }));
		expect(a.technique + a.sightReading + a.repertoireTotal + a.warmup).toBe(
			20,
		);
	});

	it("interpolates 50 min balanced and sums to 50", () => {
		const a = allocateTime(inputs({ totalMinutes: 50 }));
		expect(a.technique + a.sightReading + a.repertoireTotal + a.warmup).toBe(
			50,
		);
	});

	it("extrapolates 75 min and sums to 75 with warmup 5", () => {
		const a = allocateTime(inputs({ totalMinutes: 75 }));
		expect(a.warmup).toBe(5);
		expect(a.technique + a.sightReading + a.repertoireTotal + a.warmup).toBe(
			75,
		);
	});

	it("redistributes technique into repertoire when disabled", () => {
		const a = allocateTime(
			inputs({ totalMinutes: 30, techniqueEnabled: false }),
		);
		expect(a.technique).toBe(0);
		expect(a.repertoireTotal).toBe(19 + 7);
		expect(a.sightReading).toBe(4);
	});

	it("redistributes sight-reading into repertoire when disabled", () => {
		const a = allocateTime(
			inputs({ totalMinutes: 30, sightReadingEnabled: false }),
		);
		expect(a.sightReading).toBe(0);
		expect(a.repertoireTotal).toBe(19 + 4);
		expect(a.technique).toBe(7);
	});

	it("both disabled → all into repertoire", () => {
		const a = allocateTime(
			inputs({
				totalMinutes: 30,
				techniqueEnabled: false,
				sightReadingEnabled: false,
			}),
		);
		expect(a.repertoireTotal).toBe(30);
	});

	it("repertoire sub-split 55/30/15 at 30 balanced rep=19", () => {
		const a = allocateTime(inputs({ totalMinutes: 30, emphasis: "balanced" }));
		expect(a.repertoireTotal).toBe(19);
		expect(a.repertoireLearning).toBe(10);
		expect(a.repertoireStabilizing).toBe(6);
		expect(a.repertoireMaintenance).toBe(3);
	});

	it("drops maintenance when rep < 12", () => {
		const a = allocateTime(inputs({ totalMinutes: 15, emphasis: "balanced" }));
		expect(a.repertoireTotal).toBe(10);
		expect(a.repertoireLearning).toBe(7);
		expect(a.repertoireStabilizing).toBe(3);
		expect(a.repertoireMaintenance).toBe(0);
	});

	it("collapses to learning only when rep < 7", () => {
		const a = allocateTime(
			inputs({ totalMinutes: 15, emphasis: "technique-heavy" }),
		);
		expect(a.repertoireTotal).toBe(9);
		expect(a.repertoireLearning).toBe(6);
		expect(a.repertoireStabilizing).toBe(3);
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
		const pieces: Piece[] = [
			// 5 min play-through → cost round(5 × 1.2) = 6
			makePiece({
				id: "p1",
				state: "maintenance",
				title: "A",
				lastPracticed: days,
				durationSeconds: 300,
			}),
			// 5 min play-through → cost 6
			makePiece({
				id: "p2",
				state: "maintenance",
				title: "B",
				lastPracticed: days,
				durationSeconds: 300,
			}),
			// 5 min play-through → cost 6 (won't fit: 6 + 6 = 12 > 13? fits; third 6 > 1 → stop)
			makePiece({
				id: "p3",
				state: "maintenance",
				title: "C",
				lastPracticed: days,
				durationSeconds: 300,
			}),
		];
		const { blocks, leftoverMinutes } = pickRepertoireMaintenanceBlocks(
			pieces,
			13,
			NOW,
		);
		expect(blocks).toHaveLength(2);
		expect(blocks.every((b) => b.allocatedMinutes === 6)).toBe(true);
		expect(leftoverMinutes).toBe(1);
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

	it("always takes the first piece even when it overruns the budget", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({
				id: "p1",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 1800, // 30 min → cost round(30 × 1.2) = 36
			}),
			makePiece({
				id: "p2",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 300,
			}),
		];
		const { blocks, leftoverMinutes } = pickRepertoireMaintenanceBlocks(
			pieces,
			5,
			NOW,
		);
		expect(blocks).toHaveLength(1);
		expect(blocks[0].allocatedMinutes).toBe(36);
		expect(leftoverMinutes).toBe(0);
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

	it("worked example: tech10/read5/rep15, 5 freed → 12/6/17, sum conserved", () => {
		const a = alloc({
			technique: 10,
			sightReading: 5,
			repertoireLearning: 15,
			repertoireMaintenance: 5,
		});
		const v = avail({ repertoireMaintenance: false });
		const r = redistributeForAvailability(a, v);
		expect(r.technique).toBe(12);
		expect(r.sightReading).toBe(6);
		expect(r.repertoireLearning).toBe(17);
		expect(r.repertoireMaintenance).toBe(0);
		const total =
			r.technique +
			r.sightReading +
			r.repertoireLearning +
			r.repertoireStabilizing +
			r.repertoireMaintenance;
		expect(total).toBe(35);
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
		expect(r.sightReading).toBe(9);
		expect(r.repertoireLearning).toBe(9);
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
		expect(r.technique + r.sightReading).toBe(20);
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

describe("buildPlan", () => {
	it("orders blocks per balanced emphasis", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "learning" }),
			makePiece({ id: "p2", state: "stabilizing" }),
			makePiece({ id: "p3", state: "maintenance" }),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(inputs({ totalMinutes: 30 }), pieces, [], ts, NOW);
		const kinds = plan.blocks.map((b) => b.kind);
		expect(kinds[0]).toBe("technique");
		expect(kinds[1]).toBe("sight-reading");
		expect(kinds[2]).toBe("repertoire-learning");
		expect(kinds[3]).toBe("repertoire-stabilizing");
		expect(kinds[4]).toBe("repertoire-maintenance");
	});

	it("includes warmup for 60+ min", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [
			makeTechnique({ id: "a1", state: "active" }),
			makeTechnique({
				id: "m1",
				state: "maintenance" as TechniqueState,
			}),
		];
		const plan = buildPlan(inputs({ totalMinutes: 60 }), pieces, [], ts, NOW);
		expect(plan.blocks[0].kind).toBe("warmup");
	});

	it("omits sight-reading block when allocation is 0", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(
			inputs({ totalMinutes: 30, sightReadingEnabled: false }),
			pieces,
			[],
			[],
			NOW,
		);
		expect(plan.blocks.find((b) => b.kind === "sight-reading")).toBeUndefined();
	});

	it("drops technique block when no techniques available", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(inputs({ totalMinutes: 30 }), pieces, [], [], NOW);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeUndefined();
	});

	it("redistributes when no learning pieces", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p2", state: "stabilizing" }),
			makePiece({ id: "p3", state: "maintenance" }),
		];
		const plan = buildPlan(inputs({ totalMinutes: 30 }), pieces, [], [], NOW);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-learning"),
		).toBeUndefined();
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-stabilizing"),
		).toBeDefined();
	});

	it("deterministic: same inputs → same plan", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const p1 = buildPlan(inputs({ totalMinutes: 30 }), pieces, [], ts, NOW);
		const p2 = buildPlan(inputs({ totalMinutes: 30 }), pieces, [], ts, NOW);
		expect(p2.blocks.map((b) => b.kind)).toEqual(p1.blocks.map((b) => b.kind));
		expect(p2.blocks.map((b) => b.pieceId)).toEqual(
			p1.blocks.map((b) => b.pieceId),
		);
	});

	it("repertoire-only emphasis has no technique or sight-reading blocks", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(
			inputs({ totalMinutes: 30, emphasis: "repertoire-only" }),
			pieces,
			[],
			[],
			NOW,
		);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeUndefined();
		expect(plan.blocks.find((b) => b.kind === "sight-reading")).toBeUndefined();
	});

	it("reading-heavy puts sight-reading before technique", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			inputs({ totalMinutes: 30, emphasis: "reading-heavy" }),
			pieces,
			[],
			ts,
			NOW,
		);
		const sIdx = plan.blocks.findIndex((b) => b.kind === "sight-reading");
		const tIdx = plan.blocks.findIndex((b) => b.kind === "technique");
		expect(sIdx).toBeGreaterThanOrEqual(0);
		expect(tIdx).toBeGreaterThan(sIdx);
	});

	it("technique-heavy puts technique before sight-reading", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(
			inputs({ totalMinutes: 30, emphasis: "technique-heavy" }),
			pieces,
			[],
			ts,
			NOW,
		);
		const sIdx = plan.blocks.findIndex((b) => b.kind === "sight-reading");
		const tIdx = plan.blocks.findIndex((b) => b.kind === "technique");
		expect(tIdx).toBeLessThan(sIdx);
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
			inputs({ totalMinutes: 30, sightReadingEnabled: false }),
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
			inputs({ totalMinutes: 30, sightReadingEnabled: false }),
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
					durationSeconds: 60, // cost round(1 × 1.2) = 1
				}),
			),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(inputs({ totalMinutes: 60 }), pieces, [], ts, NOW);
		const maint = plan.blocks.filter(
			(b) => b.kind === "repertoire-maintenance",
		);
		expect(maint.length).toBeGreaterThanOrEqual(2);
		expect(maint.every((b) => b.allocatedMinutes === 1)).toBe(true);
	});

	it("maintenance leftover bumps learning + stabilizing blocks", () => {
		const days = new Date(NOW.getTime() - 5 * 86400000);
		const pieces: Piece[] = [
			makePiece({ id: "pl", state: "learning" }),
			makePiece({ id: "ps", state: "stabilizing" }),
			makePiece({
				id: "pm",
				state: "maintenance",
				lastPracticed: days,
				durationSeconds: 60, // cost 1 → leftover 4 of a 5-min maintenance budget
			}),
		];
		const ts: TechniqueItem[] = [makeTechnique({ id: "a1", state: "active" })];
		const plan = buildPlan(inputs({ totalMinutes: 60 }), pieces, [], ts, NOW);
		const learn = plan.blocks.find((b) => b.kind === "repertoire-learning");
		const stab = plan.blocks.find((b) => b.kind === "repertoire-stabilizing");
		// base 19/11 + leftover 4 split proportionally (3 to learning, 1 to stabilizing)
		expect(learn?.allocatedMinutes).toBe(22);
		expect(stab?.allocatedMinutes).toBe(12);
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
			inputs({ totalMinutes: 30, emphasis: "repertoire-only" }),
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
		const plan = buildPlan(
			inputs({ totalMinutes: 60 }),
			pieces,
			[],
			ts,
			NOW_LOCAL,
		);
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
		const plan = buildPlan(
			inputs({ totalMinutes: 30 }),
			pieces,
			[],
			ts,
			NOW_LOCAL,
		);
		expect(plan.blocks.find((b) => b.kind === "technique")).toBeUndefined();
		const om = plan.omitted?.find((o) => o.kind === "technique");
		expect(om?.reason).toBe("practiced-today");
		expect(om?.redistributedMinutes).toBe(7);
	});

	it("buildPlan: omitted reason=no-content when pool has no techniques at all", () => {
		const pieces: Piece[] = [makePiece({ id: "p1", state: "learning" })];
		const plan = buildPlan(
			inputs({ totalMinutes: 30 }),
			pieces,
			[],
			[],
			NOW_LOCAL,
		);
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
		const plan = buildPlan(
			inputs({ totalMinutes: 30 }),
			pieces,
			[],
			[],
			NOW_LOCAL,
		);
		expect(
			plan.blocks.find((b) => b.kind === "repertoire-learning"),
		).toBeUndefined();
		const om = plan.omitted?.find((o) => o.kind === "repertoire-learning");
		expect(om?.reason).toBe("practiced-today");
	});
});
