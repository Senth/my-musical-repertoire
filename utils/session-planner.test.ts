import type { Piece, PieceState } from "@/models/piece";
import type { Section } from "@/models/section";
import type { SessionEmphasis, SessionInputs } from "@/models/session";
import type { TechniqueItem, TechniqueState } from "@/models/technique";
import {
	allocateTime,
	buildPlan,
	pickRepertoireMaintenance,
	pickRepertoireSection,
	pickTechnique,
	pickWarmup,
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

describe("pickRepertoireMaintenance", () => {
	it("includes maintenance + performance pieces", () => {
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
		const b = pickRepertoireMaintenance(pieces, 5, NOW);
		// performance × 3 weight beats maintenance × 1 with same staleness
		expect(b?.pieceId).toBe("p2");
	});

	it("excludes on_hold and shelved", () => {
		const pieces: Piece[] = [
			makePiece({ id: "p1", state: "on_hold" as PieceState }),
			makePiece({ id: "p2", state: "shelved" as PieceState }),
		];
		expect(pickRepertoireMaintenance(pieces, 5, NOW)).toBeNull();
	});

	it("BPM gap influences score", () => {
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
		const b = pickRepertoireMaintenance(pieces, 5, NOW);
		expect(b?.pieceId).toBe("p1");
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
});
