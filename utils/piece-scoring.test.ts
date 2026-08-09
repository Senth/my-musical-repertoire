import { suggestPieces } from "./overview-suggestions";
import {
	bestCandidateByPiece,
	groupSectionsByPiece,
	scorePiece,
	scorePieces,
} from "./piece-scoring";
import {
	buildSectionCandidates,
	scoreMaintenancePiece,
} from "./planner-scoring";
import { makePiece, makeSection } from "./test-factories";

const NOW = new Date("2026-06-01T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe("scorePiece", () => {
	it("falls back to the whole-piece maintenance score when there are no sections", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: daysAgo(4),
		});
		expect(scorePiece(piece, [], NOW)).toBe(scoreMaintenancePiece(piece, NOW));
	});

	it("takes the highest-scoring section, not the average", () => {
		const piece = makePiece({ id: "p1", state: "learning" });
		const stale = makeSection({
			id: "s1",
			pieceId: "p1",
			phase: "learning",
			lastPracticed: daysAgo(20),
		});
		const fresh = makeSection({
			id: "s2",
			pieceId: "p1",
			phase: "learning",
			lastPracticed: daysAgo(1),
		});

		const both = scorePiece(piece, [stale, fresh], NOW);
		expect(both).toBe(scorePiece(piece, [stale], NOW));
		expect(both).toBeGreaterThan(scorePiece(piece, [fresh], NOW));
	});

	it("ignores archived sections", () => {
		const piece = makePiece({ id: "p1", state: "learning" });
		const archived = makeSection({
			id: "s1",
			pieceId: "p1",
			archived: true,
			lastPracticed: daysAgo(90),
		});
		const live = makeSection({
			id: "s2",
			pieceId: "p1",
			lastPracticed: daysAgo(2),
		});
		expect(scorePiece(piece, [archived, live], NOW)).toBe(
			scorePiece(piece, [live], NOW),
		);
	});

	it("scores a piece whose only sections are archived as if it had none", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: daysAgo(3),
		});
		const archived = makeSection({
			id: "s1",
			pieceId: "p1",
			archived: true,
		});
		expect(scorePiece(piece, [archived], NOW)).toBe(
			scoreMaintenancePiece(piece, NOW),
		);
	});

	it("respects a section's target BPM override", () => {
		const piece = makePiece({
			id: "p1",
			state: "learning",
			targetTempoBpm: 100,
		});
		const section = makeSection({
			id: "s1",
			pieceId: "p1",
			phase: "learning",
			byMode: { HT: { bpm: 60, lastPracticed: daysAgo(1) } },
			lastPracticed: daysAgo(1),
		});
		const overridden = { ...section, targetBpmOverride: 160 };
		expect(scorePiece(piece, [overridden], NOW)).toBeGreaterThan(
			scorePiece(piece, [section], NOW),
		);
	});
});

describe("scorePieces", () => {
	it("keys every piece that has an id", () => {
		const pieces = [
			makePiece({ id: "p1", state: "learning" }),
			makePiece({ id: "p2", state: "maintenance", lastPracticed: daysAgo(2) }),
		];
		const sections = [makeSection({ id: "s1", pieceId: "p1" })];
		const scores = scorePieces(pieces, sections, NOW);
		expect(Object.keys(scores).sort()).toEqual(["p1", "p2"]);
	});

	it("agrees with what the overview scores the same piece at", () => {
		// The overview picks its learning suggestion from the best section
		// candidate; the list must not put that piece anywhere else.
		const piece = makePiece({
			id: "p1",
			state: "learning",
			targetTempoBpm: 120,
		});
		const sections = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				byMode: { HT: { bpm: 80, lastPracticed: daysAgo(6) } },
				lastPracticed: daysAgo(6),
			}),
			makeSection({
				id: "s2",
				pieceId: "p1",
				phase: "stabilizing",
				byMode: { HT: { bpm: 110, lastPracticed: daysAgo(2) } },
				lastPracticed: daysAgo(2),
			}),
		];

		const { suggestions } = suggestPieces([piece], sections, NOW);
		expect(suggestions).toHaveLength(1);
		expect(scorePieces([piece], sections, NOW).p1).toBe(suggestions[0].score);
	});
});

describe("groupSectionsByPiece", () => {
	it("groups by piece and drops archived sections", () => {
		const sections = [
			makeSection({ id: "s1", pieceId: "p1" }),
			makeSection({ id: "s2", pieceId: "p1", archived: true }),
			makeSection({ id: "s3", pieceId: "p2" }),
		];
		const grouped = groupSectionsByPiece(sections);
		expect(grouped.get("p1")?.map((s) => s.id)).toEqual(["s1"]);
		expect(grouped.get("p2")?.map((s) => s.id)).toEqual(["s3"]);
	});
});

describe("bestCandidateByPiece", () => {
	it("keeps one candidate per piece — the highest scoring one", () => {
		const piece = makePiece({ id: "p1", state: "learning" });
		const sections = [
			makeSection({
				id: "s1",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: daysAgo(1),
			}),
			makeSection({
				id: "s2",
				pieceId: "p1",
				phase: "learning",
				lastPracticed: daysAgo(30),
			}),
		];
		const best = bestCandidateByPiece(
			buildSectionCandidates([piece], sections, NOW),
		);
		expect(best.size).toBe(1);
		expect(best.get("p1")?.section?.id).toBe("s2");
	});
});
