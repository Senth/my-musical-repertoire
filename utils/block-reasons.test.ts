import i18next from "i18next";
import enUS from "@/i18n/locales/en-US.json";
import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import {
	reasonForCandidate,
	reasonForMaintenancePiece,
	reasonForSpan,
	reasonForTechnique,
	reasonText,
} from "./block-reasons";
import { buildSectionCandidates, scoreTechniqueModes } from "./planner-scoring";
import { makePiece, makeSection, makeTechnique } from "./test-factories";

const NOW = new Date("2026-05-27T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const LAST_NIGHT = new Date(NOW.getTime() - 20 * 3_600_000);

const i18n = i18next.createInstance();
void i18n.init({
	lng: "en-US",
	resources: { "en-US": { translation: enUS } },
	interpolation: { escapeValue: false },
	initAsync: false,
});
const t = i18n.t;

function candidate(piece: Piece, section?: Partial<Section>) {
	const sections = section
		? [makeSection({ id: "s1", pieceId: piece.id ?? "", ...section })]
		: [];
	return buildSectionCandidates([piece], sections, NOW)[0];
}

describe("reasonForCandidate", () => {
	const piece = makePiece({ id: "p1", targetTempoBpm: 120 });

	it("is neverPracticed with no history", () => {
		expect(reasonForCandidate(candidate(piece), NOW)).toEqual({
			key: "neverPracticed",
			params: {},
		});
	});

	it("is bpmGap when the tempo term dominates", () => {
		const c = candidate(piece, {
			lastPracticed: daysAgo(1),
			byMode: { HT: { bpm: 10, lastPracticed: daysAgo(1) } },
		});
		const reason = reasonForCandidate(c, NOW);
		expect(reason.key).toBe("bpmGap");
		expect(reason.params.gap).toBe(110);
	});

	it("is notClean when quality drove the needs-work term", () => {
		const c = candidate(piece, {
			state: "maintenance",
			lastPracticed: daysAgo(1),
			lastQuality: 2,
			lastEffort: 2,
		});
		expect(reasonForCandidate(c, NOW).key).toBe("notClean");
	});

	it("is feltHard when effort drove the needs-work term", () => {
		const c = candidate(piece, {
			state: "maintenance",
			lastPracticed: daysAgo(1),
			lastQuality: 4,
			lastEffort: 4,
		});
		expect(reasonForCandidate(c, NOW).key).toBe("feltHard");
	});

	it("is notClean on a tie between quality and effort", () => {
		const c = candidate(piece, {
			state: "maintenance",
			lastPracticed: daysAgo(1),
			lastQuality: 3,
			lastEffort: 3,
		});
		expect(reasonForCandidate(c, NOW).key).toBe("notClean");
	});

	it("is daysSince by default", () => {
		const c = candidate({ ...piece, lastPracticed: daysAgo(2) });
		expect(reasonForCandidate(c, NOW)).toEqual({
			key: "daysSince",
			params: { count: 2 },
		});
	});

	it("clamps a same-day count to 1", () => {
		const c = candidate({ ...piece, lastPracticed: LAST_NIGHT });
		expect(reasonForCandidate(c, NOW)).toEqual({
			key: "daysSince",
			params: { count: 1 },
		});
	});
});

describe("reasonForMaintenancePiece", () => {
	it("is neverPracticed with no history", () => {
		const piece = makePiece({ id: "p1", state: "maintenance" });
		expect(reasonForMaintenancePiece(piece, NOW).key).toBe("neverPracticed");
	});

	it("is mistakes when mistakes outweigh the days", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: daysAgo(1),
			lastTechnicalMistakes: 3,
			lastMemoryMistakes: 3,
		});
		expect(reasonForMaintenancePiece(piece, NOW).key).toBe("mistakes");
	});

	it("is daysSince when the days outweigh the mistakes", () => {
		const piece = makePiece({
			id: "p1",
			state: "performance",
			lastPracticed: daysAgo(4),
			lastTechnicalMistakes: 2,
		});
		expect(reasonForMaintenancePiece(piece, NOW)).toEqual({
			key: "daysSince",
			params: { count: 4 },
		});
	});

	it("clamps a same-day count to 1", () => {
		const piece = makePiece({
			id: "p1",
			state: "maintenance",
			lastPracticed: LAST_NIGHT,
		});
		expect(reasonForMaintenancePiece(piece, NOW).params).toEqual({ count: 1 });
	});
});

describe("reasonForTechnique", () => {
	it("is neverPracticed with no history", () => {
		const tech = makeTechnique({ id: "t1" });
		expect(reasonForTechnique(tech, null, NOW).key).toBe("neverPracticed");
	});

	it("is notClean from the item fields when quality drove the bonus", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "maintenance",
			lastPracticedAt: daysAgo(1),
			lastQuality: 2,
		});
		expect(reasonForTechnique(tech, null, NOW).key).toBe("notClean");
	});

	it("is feltHard from the item fields when effort drove the bonus", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "maintenance",
			lastPracticedAt: daysAgo(1),
			lastEffort: 5,
		});
		expect(reasonForTechnique(tech, null, NOW).key).toBe("feltHard");
	});

	it("is notClean on a tie between quality and effort", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "maintenance",
			lastPracticedAt: daysAgo(1),
			lastQuality: 3,
			lastEffort: 3,
		});
		expect(reasonForTechnique(tech, null, NOW).key).toBe("notClean");
	});

	it("is daysSince by default", () => {
		const tech = makeTechnique({ id: "t1", lastPracticedAt: daysAgo(3) });
		expect(reasonForTechnique(tech, null, NOW)).toEqual({
			key: "daysSince",
			params: { count: 3 },
		});
	});

	it("clamps a same-day count to 1", () => {
		const tech = makeTechnique({ id: "t1", lastPracticedAt: LAST_NIGHT });
		expect(reasonForTechnique(tech, null, NOW).params).toEqual({ count: 1 });
	});

	it("reads the stats of the hand that won the score, not the item fields", () => {
		const tech = makeTechnique({
			id: "t1",
			lastPracticedAt: daysAgo(1),
			lastQuality: 1,
			byMode: {
				LH: { lastPracticed: daysAgo(1), quality: 5 },
				RH: { lastPracticed: daysAgo(6), quality: 5 },
			},
		});
		const { modeKey } = scoreTechniqueModes(tech, NOW);
		expect(modeKey).toBe("RH");
		expect(reasonForTechnique(tech, modeKey, NOW)).toEqual({
			key: "daysSince",
			params: { count: 6 },
		});
	});

	it("names the winning hand's effort even when the item fields are clean", () => {
		const tech = makeTechnique({
			id: "t1",
			state: "maintenance",
			lastPracticedAt: daysAgo(1),
			byMode: {
				LH: { lastPracticed: daysAgo(1), quality: 5, effort: 1 },
				RH: { lastPracticed: daysAgo(1), quality: 5, effort: 5 },
			},
		});
		const { modeKey } = scoreTechniqueModes(tech, NOW);
		expect(modeKey).toBe("RH");
		expect(reasonForTechnique(tech, modeKey, NOW).key).toBe("feltHard");
	});
});

describe("reasonForSpan", () => {
	it("is spanNeverPracticed when the joins were never played", () => {
		const piece = makePiece({ id: "p1" });
		expect(reasonForSpan(piece, NOW).key).toBe("spanNeverPracticed");
	});

	it("is spanDue with the days since the joins were played", () => {
		const piece = makePiece({ id: "p1", lastSpanPracticedAt: daysAgo(9) });
		expect(reasonForSpan(piece, NOW)).toEqual({
			key: "spanDue",
			params: { count: 9 },
		});
	});

	it("clamps a same-day count to 1", () => {
		const piece = makePiece({ id: "p1", lastSpanPracticedAt: LAST_NIGHT });
		expect(reasonForSpan(piece, NOW).params).toEqual({ count: 1 });
	});
});

describe("reasonText", () => {
	it("pluralises the day count", () => {
		expect(
			reasonText({ key: "daysSince", params: { count: 1 } }, null, t),
		).toBe("Last practiced 1 day ago");
		expect(reasonText({ key: "spanDue", params: { count: 3 } }, null, t)).toBe(
			"Joins not played for 3 days",
		);
	});

	it("prefixes the mode when there is one", () => {
		expect(reasonText({ key: "notClean", params: {} }, "RH", t)).toBe(
			"Right hand · Last time wasn't clean",
		);
	});
});
