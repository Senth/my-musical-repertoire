import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	buildSectionCandidates,
	daysSince,
	PHASE_SCORE,
	scoreMaintenancePiece,
	scoreSectionCandidate,
	scoreTechnique,
	techniquePracticedToday,
} from "./planner-scoring";
import { makePiece, makeSection, makeTechnique } from "./test-factories";

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

	it("adds BPM gap term for learning", () => {
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const past = new Date(NOW.getTime() - 1 * 86_400_000);
		const score = scoreSectionCandidate(piece, "learning", past, 80, NOW);
		expect(score).toBe(PHASE_SCORE.learning * 1 + 40);
	});

	it("adds BPM gap term for stabilizing", () => {
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const past = new Date(NOW.getTime() - 2 * 86_400_000);
		const score = scoreSectionCandidate(piece, "stabilizing", past, 100, NOW);
		expect(score).toBe(PHASE_SCORE.stabilizing * 2 + 20);
	});

	it("never-practiced returns 999 days × phaseScore", () => {
		const piece = makePiece({ id: "p1" });
		const score = scoreSectionCandidate(piece, "stabilizing", null, null, NOW);
		expect(score).toBe(PHASE_SCORE.stabilizing * 999);
	});

	it("maintenance: uses days + effort/quality bonus, no bpmGap", () => {
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const past = new Date(NOW.getTime() - 3 * 86_400_000);
		const score = scoreSectionCandidate(
			piece,
			"maintenance",
			past,
			80,
			NOW,
			3,
			4,
		);
		// days=3, effort=4 → +3, quality=3 → +2; bpmGap ignored
		expect(score).toBe(3 + 3 + 2);
	});

	it("maintenance: defaults effort/quality give 0 bonus", () => {
		const piece = makePiece({ id: "p1" });
		const past = new Date(NOW.getTime() - 5 * 86_400_000);
		const score = scoreSectionCandidate(piece, "maintenance", past, null, NOW);
		expect(score).toBe(5);
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

	it("adds mistakes term at weight 2", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: new Date(NOW.getTime() - 2 * 86_400_000),
			lastTechnicalMistakes: 2, // some
			lastMemoryMistakes: 1, // few
		});
		// days=2, 2*(2+1)=6
		expect(scoreMaintenancePiece(piece, NOW)).toBe(2 + 6);
	});

	it("returns 999 for never-practiced", () => {
		const piece = makePiece({ id: "p1", state: "maintenance" });
		expect(scoreMaintenancePiece(piece, NOW)).toBe(999);
	});

	it("defaults missing mistakes to 0", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: new Date(NOW.getTime() - 3 * 86_400_000),
		});
		expect(scoreMaintenancePiece(piece, NOW)).toBe(3);
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

describe("per-mode scoring", () => {
	const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
	const piece = makePiece({ id: "p1", state: "learning", targetTempoBpm: 100 });

	const candidateFor = (section: Section) =>
		buildSectionCandidates([piece], [section], NOW)[0];

	it("takes the maximum across modes and records the winner", () => {
		// LH: 1 day, 115 target − 60 = 55 gap → 10 + 55 = 65
		// HT: 1 day, 100 target − 95 = 5 gap  → 10 + 5  = 15
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				byMode: {
					LH: { bpm: 60, lastPracticed: daysAgo(1) },
					HT: { bpm: 95, lastPracticed: daysAgo(1) },
				},
			}),
		);
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 55);
		expect(candidate.modeKey).toBe("LH");
	});

	it("measures LH against the hands-separate target, HT against the plain one", () => {
		const separate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: { LH: { bpm: 90, lastPracticed: daysAgo(1) } },
			}),
		);
		const together = candidateFor(
			makeSection({
				id: "s2",
				pieceId: "p1",
				byMode: { HT: { bpm: 90, lastPracticed: daysAgo(1) } },
			}),
		);
		// hands-separate target is 115, hands-together 100
		expect(separate.score).toBe(PHASE_SCORE.learning * 1 + 25);
		expect(together.score).toBe(PHASE_SCORE.learning * 1 + 10);
	});

	it("ignores modes that were never practised", () => {
		// RH is absent — it must not contribute a 999-day score.
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: { LH: { bpm: 115, lastPracticed: daysAgo(2) } },
			}),
		);
		expect(candidate.score).toBe(PHASE_SCORE.learning * 2);
		expect(candidate.modeKey).toBe("LH");
	});

	it("scores a maintenance section with only HT present", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "maintenance",
				byMode: {
					HT: { bpm: 80, quality: 3, effort: 4, lastPracticed: daysAgo(3) },
				},
			}),
		);
		// days=3, effort=4 → +3, quality=3 → +2; no bpm term in maintenance
		expect(candidate.score).toBe(3 + 3 + 2);
		expect(candidate.modeKey).toBe("HT");
	});

	it("scores drill modes against their hands mode's target", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: { "LH.staccato": { bpm: 90, lastPracticed: daysAgo(1) } },
			}),
		);
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 25);
		expect(candidate.modeKey).toBe("LH.staccato");
	});

	it("uses the section's target override over the piece target", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				targetBpmOverride: 60,
				byMode: { HT: { bpm: 50, lastPracticed: daysAgo(1) } },
			}),
		);
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 10);
	});

	it("drops only the modes practised today", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: {
					LH: { bpm: 10, lastPracticed: NOW },
					RH: { bpm: 100, lastPracticed: daysAgo(1) },
				},
			}),
		);
		expect(candidate.practicedToday).toBe(false);
		expect(candidate.modeKey).toBe("RH");
	});

	it("marks the section done only when every mode was practised today", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: {
					LH: { bpm: 100, lastPracticed: NOW },
					RH: { bpm: 100, lastPracticed: NOW },
				},
			}),
		);
		expect(candidate.practicedToday).toBe(true);
	});

	it("falls back to legacy fields when byMode is empty", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: {},
				currentBpm: 80,
				lastPracticed: daysAgo(1),
			}),
		);
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 20);
		expect(candidate.modeKey).toBeNull();
	});

	it("keeps the 999-day score for a never-practised section", () => {
		const candidate = candidateFor(
			makeSection({ id: "s1", pieceId: "p1", phase: "stabilizing" }),
		);
		expect(candidate.score).toBe(PHASE_SCORE.stabilizing * 999);
		expect(candidate.modeKey).toBeNull();
	});
});

describe("scoreTechnique per mode", () => {
	const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

	it("takes the stalest mode's score", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			lastPracticedAt: daysAgo(1),
			byMode: {
				LH: { lastPracticed: daysAgo(1) },
				RH: { lastPracticed: daysAgo(6) },
			},
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 6);
	});

	it("ignores modes practised today", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			byMode: {
				LH: { lastPracticed: NOW },
				RH: { lastPracticed: daysAgo(2) },
			},
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 2);
		expect(techniquePracticedToday(tech, NOW)).toBe(false);
	});

	it("is done for the day only when every mode was practised today", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			byMode: { LH: { lastPracticed: NOW }, RH: { lastPracticed: NOW } },
		});
		expect(techniquePracticedToday(tech, NOW)).toBe(true);
	});

	it("falls back to legacy fields when byMode is empty", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			lastPracticedAt: daysAgo(3),
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 3);
		expect(techniquePracticedToday(tech, NOW)).toBe(false);
	});

	it("ignores a mode the technique no longer offers", () => {
		// Left over from when this was handsMode "both" — HT is unreachable now.
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			handsMode: "separate",
			lastPracticedAt: daysAgo(2),
			byMode: {
				HT: { lastPracticed: daysAgo(90) },
				LH: { lastPracticed: daysAgo(2) },
				RH: { lastPracticed: daysAgo(2) },
			},
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 2);
	});

	it("ignores a drill mode after the drill is turned off", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			handsMode: "separate",
			activeDrills: [],
			byMode: {
				"LH.staccato": { lastPracticed: daysAgo(90) },
				LH: { lastPracticed: daysAgo(1) },
				RH: { lastPracticed: daysAgo(1) },
			},
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 1);
	});

	it("is done for the day when every reachable mode was practised today", () => {
		// The stale HT must not keep the technique eligible.
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			handsMode: "separate",
			byMode: {
				HT: { lastPracticed: daysAgo(90) },
				LH: { lastPracticed: NOW },
				RH: { lastPracticed: NOW },
			},
		});
		expect(techniquePracticedToday(tech, NOW)).toBe(true);
	});

	it("still scores a technique whose only modes are unreachable", () => {
		// Nothing reachable has been practised — legacy fallback keeps it visible.
		const tech = makeTechnique({
			id: "t1",
			state: "active",
			handsMode: "separate",
			lastPracticedAt: daysAgo(4),
			byMode: { HT: { lastPracticed: daysAgo(4) } },
		});
		expect(scoreTechnique(tech, NOW)).toBe(10 * 4);
		expect(techniquePracticedToday(tech, NOW)).toBe(false);
	});
});
