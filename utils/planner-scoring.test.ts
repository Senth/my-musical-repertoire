import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	buildSectionCandidates,
	daysSince,
	needsWorkTerm,
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

describe("needsWorkTerm", () => {
	it("is 0 for an unlogged attempt", () => {
		expect(needsWorkTerm(null, null)).toBe(0);
		expect(needsWorkTerm(undefined, undefined)).toBe(0);
		expect(needsWorkTerm(5, 1)).toBe(0);
	});

	it("squares, so a minor slip is nearly free and a collapse is an emergency", () => {
		expect(needsWorkTerm(4, 2)).toBe(2); // minor slips, comfortable
		expect(needsWorkTerm(3, 3)).toBe(8); // middling
		expect(needsWorkTerm(2, 4)).toBe(18); // rough, demanding
		expect(needsWorkTerm(1, 5)).toBe(32); // fell apart, at my limit
	});
});

describe("scoreSectionCandidate", () => {
	// docs/specs/learning-line-greedy-selection.md §3.1
	it("applies phase weight × days", () => {
		const piece = makePiece({ id: "p1" });
		const past = new Date(NOW.getTime() - 3 * 86_400_000);
		const score = scoreSectionCandidate(piece, "learning", past, null, NOW);
		expect(score).toBe(PHASE_SCORE.learning * 3);
	});

	it("weights the BPM gap by phase", () => {
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const day = new Date(NOW.getTime() - 1 * 86_400_000);
		// Learning gaps are large, so the weight is small — 0.25 × 40.
		expect(scoreSectionCandidate(piece, "learning", day, 80, NOW)).toBe(
			10 + 10,
		);
		// Stabilizing gaps are small — 0.5 × 20.
		expect(scoreSectionCandidate(piece, "stabilizing", day, 100, NOW)).toBe(
			3 + 10,
		);
		// A maintenance section below tempo costs a full day of neglect per bpm.
		expect(scoreSectionCandidate(piece, "maintenance", day, 112, NOW)).toBe(
			1 + 8,
		);
	});

	it("adds the needs-work term at the phase weight", () => {
		const piece = makePiece({ id: "p1" });
		const day = new Date(NOW.getTime() - 1 * 86_400_000);
		// q2/e4 → 18, halved for learning.
		expect(scoreSectionCandidate(piece, "learning", day, null, NOW, 2, 4)).toBe(
			10 + 9,
		);
		expect(
			scoreSectionCandidate(piece, "stabilizing", day, null, NOW, 2, 4),
		).toBe(3 + 18);
	});

	it("never-practiced returns 999 days × phaseScore", () => {
		const piece = makePiece({ id: "p1" });
		const score = scoreSectionCandidate(piece, "stabilizing", null, null, NOW);
		expect(score).toBe(PHASE_SCORE.stabilizing * 999);
	});

	it("ranks a struggle above a smaller tempo gap (the acceptance case)", () => {
		// A section at 30 bpm that went perfectly must score BELOW one at 40 bpm
		// that fell apart, even though 40 is closer to the 60 target.
		const piece = makePiece({ id: "p1", targetTempoBpm: 60 });
		const day = new Date(NOW.getTime() - 1 * 86_400_000);
		const easy = scoreSectionCandidate(piece, "learning", day, 30, NOW, 5, 1);
		const hard = scoreSectionCandidate(piece, "learning", day, 40, NOW, 2, 5);
		expect(easy).toBe(10 + 7.5); // 0.25 × 30 gap, no needs-work
		expect(hard).toBe(10 + 5 + 12.5); // 0.25 × 20 gap, 0.5 × 25 needs-work
		expect(hard).toBeGreaterThan(easy);
	});

	it("lets neglect and struggle carry a review past new acquisition", () => {
		// §3.1's behaviour table: target 120, learning at 70, stabilizing at 110.
		const piece = makePiece({ id: "p1", targetTempoBpm: 120 });
		const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
		const learningBaseline = scoreSectionCandidate(
			piece,
			"learning",
			daysAgo(1),
			70,
			NOW,
			3,
			4,
		);
		expect(learningBaseline).toBe(29);

		// Fell apart yesterday → repeat it, correct.
		expect(
			scoreSectionCandidate(piece, "learning", daysAgo(1), 70, NOW, 1, 5),
		).toBe(38.5);
		// Review wins on neglect …
		expect(
			scoreSectionCandidate(piece, "stabilizing", daysAgo(8), 110, NOW, 4, 2),
		).toBeGreaterThan(learningBaseline);
		// … and on struggle, three days after a rough pass.
		expect(
			scoreSectionCandidate(piece, "stabilizing", daysAgo(3), 110, NOW, 2, 4),
		).toBeGreaterThan(learningBaseline);
		// Recent and fine → skipped.
		expect(
			scoreSectionCandidate(piece, "stabilizing", daysAgo(3), 110, NOW, 4, 2),
		).toBeLessThan(learningBaseline);
		// Maintenance on target rarely surfaces, but drift is visible.
		expect(
			scoreSectionCandidate(piece, "maintenance", daysAgo(14), 120, NOW, 5, 1),
		).toBe(14);
		expect(
			scoreSectionCandidate(piece, "maintenance", daysAgo(14), 112, NOW, 5, 1),
		).toBe(22);
	});

	it("defaults an unlogged attempt to no needs-work penalty", () => {
		const piece = makePiece({ id: "p1" });
		const past = new Date(NOW.getTime() - 5 * 86_400_000);
		expect(scoreSectionCandidate(piece, "maintenance", past, null, NOW)).toBe(
			5,
		);
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
		// LH: 1 day, 115 target − 60 = 55 gap → 10 + 0.25·55 = 23.75
		// HT: 1 day, 100 target − 95 = 5 gap  → 10 + 0.25·5  = 11.25
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
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 55);
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
		expect(separate.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 25);
		expect(together.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 10);
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
		// days=3, 100 target − 80 = 20 gap at weight 1, needs-work q3/e4 = 13
		expect(candidate.score).toBe(3 + 20 + 13);
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
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 25);
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
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 10);
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

	it("falls back to the section's own fields when byMode is empty", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				byMode: {},
				lastPracticed: daysAgo(1),
			}),
		);
		// No mode history means no tempo at all, so only the recency term survives.
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1);
		expect(candidate.currentBpm).toBeNull();
		expect(candidate.modeKey).toBeNull();
	});

	it("falls back to the slowest hand when every mode was practised today", () => {
		const candidate = candidateFor(
			makeSection({
				id: "s1",
				pieceId: "p1",
				lastPracticed: daysAgo(1),
				byMode: {
					LH: { bpm: 100, lastPracticed: NOW },
					RH: { bpm: 80, lastPracticed: NOW },
				},
			}),
		);
		// No scorable mode is left, so the gap comes from min(LH, RH) = 80.
		expect(candidate.score).toBe(PHASE_SCORE.learning * 1 + 0.25 * 20);
		expect(candidate.currentBpm).toBe(80);
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
