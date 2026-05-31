import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";
import {
	buildSectionCandidates,
	daysSince,
	PHASE_SCORE,
	scoreMaintenancePiece,
	scoreSectionCandidate,
	scoreTechnique,
} from "./planner-scoring";

function makePiece(over: Partial<Piece> & { id: string }): Piece {
	return {
		userId: "u",
		title: `Piece ${over.id}`,
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
	over: Partial<TechniqueItem> & { id: string },
): TechniqueItem {
	return {
		userId: "u",
		title: `T ${over.id}`,
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

describe("daysSince", () => {
	it("returns 999 for null", () => {
		expect(daysSince(null, NOW)).toBe(999);
	});

	it("returns 999 for undefined", () => {
		expect(daysSince(undefined, NOW)).toBe(999);
	});

	it("returns 0 for future date", () => {
		const future = new Date(NOW.getTime() + 86_400_000);
		expect(daysSince(future, NOW)).toBe(0);
	});

	it("returns correct days for past date", () => {
		const past = new Date(NOW.getTime() - 5 * 86_400_000);
		expect(daysSince(past, NOW)).toBe(5);
	});
});

describe("scoreSectionCandidate", () => {
	it("applies phase weight × days", () => {
		const piece = makePiece({ id: "p1" });
		const past = new Date(NOW.getTime() - 3 * 86_400_000);
		const score = scoreSectionCandidate(piece, "learning", past, null, NOW);
		expect(score).toBe(PHASE_SCORE.learning * 3);
	});

	it("adds BPM gap term", () => {
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const past = new Date(NOW.getTime() - 1 * 86_400_000);
		const score = scoreSectionCandidate(piece, "learning", past, 80, NOW);
		expect(score).toBe(PHASE_SCORE.learning * 1 + 40);
	});

	it("never-practiced returns 999 days × phaseScore", () => {
		const piece = makePiece({ id: "p1" });
		const score = scoreSectionCandidate(piece, "stabilizing", null, null, NOW);
		expect(score).toBe(PHASE_SCORE.stabilizing * 999);
	});
});

describe("scoreMaintenancePiece", () => {
	it("uses weight 1 for maintenance", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: new Date(NOW.getTime() - 4 * 86_400_000),
		});
		expect(scoreMaintenancePiece(piece, NOW)).toBe(4);
	});

	it("uses weight 3 for performance", () => {
		const piece = makePiece({
			id: "p1",
			state: "performance",
			lastPracticed: new Date(NOW.getTime() - 4 * 86_400_000),
		});
		expect(scoreMaintenancePiece(piece, NOW)).toBe(12);
	});

	it("adds BPM gap", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: new Date(NOW.getTime() - 2 * 86_400_000),
			targetTempoBpm: 120,
			lastAchievedTempoBpm: 80,
		});
		expect(scoreMaintenancePiece(piece, NOW)).toBe(2 + 40);
	});

	it("returns 999 for never-practiced", () => {
		const piece = makePiece({ id: "p1", state: "maintenance" });
		expect(scoreMaintenancePiece(piece, NOW)).toBe(999);
	});
});

describe("scoreTechnique", () => {
	it("active state scores higher than maintenance per day", () => {
		const active = makeTechnique({
			id: "a1",
			state: "active",
			lastPracticedAt: new Date(NOW.getTime() - 1 * 86_400_000),
		});
		const maint = makeTechnique({
			id: "m1",
			state: "maintenance",
			lastPracticedAt: new Date(NOW.getTime() - 1 * 86_400_000),
		});
		expect(scoreTechnique(active, NOW)).toBeGreaterThan(
			scoreTechnique(maint, NOW),
		);
	});

	it("effort/quality bonus adds to score", () => {
		const base = makeTechnique({ id: "t1", state: "active" });
		const withPenalty = makeTechnique({
			id: "t2",
			state: "active",
			lastEffort: 5,
			lastQuality: 1,
		});
		expect(scoreTechnique(withPenalty, NOW)).toBeGreaterThan(
			scoreTechnique(base, NOW),
		);
	});
});

describe("buildSectionCandidates", () => {
	it("creates virtual candidate for piece with no sections", () => {
		const pieces = [makePiece({ id: "p1", state: "learning" })];
		const candidates = buildSectionCandidates(pieces, [], NOW);
		expect(candidates).toHaveLength(1);
		expect(candidates[0].section).toBeNull();
		expect(candidates[0].phase).toBe("learning");
	});

	it("creates one candidate per non-archived section", () => {
		const pieces = [makePiece({ id: "p1", state: "learning" })];
		const sections: Section[] = [
			makeSection({ id: "s1", pieceId: "p1" }),
			makeSection({ id: "s2", pieceId: "p1" }),
			makeSection({ id: "s3", pieceId: "p1", archived: true }),
		];
		const candidates = buildSectionCandidates(pieces, sections, NOW);
		expect(candidates).toHaveLength(2);
	});

	it("skips pieces with no id", () => {
		const piece: Piece = {
			userId: "u",
			title: "No ID",
			composer: "C",
			state: "learning",
		};
		const candidates = buildSectionCandidates([piece], [], NOW);
		expect(candidates).toHaveLength(0);
	});
});
