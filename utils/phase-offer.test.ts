import type { ByMode } from "@/models/practice";
import type { PhaseTransition, SectionPhase } from "@/models/section";
import { decidePhaseOffer, type PhaseOfferInput } from "./phase-offer";
import type { ModeEntry } from "./practice-modes";
import type { ProgressionLog } from "./section-progression";
import { makePiece, makeSection } from "./test-factories";

const TARGET = 120;
const NOW = new Date(2026, 7, 8, 12, 0);

function log(day: number, over: Partial<ProgressionLog> = {}): ProgressionLog {
	return {
		date: new Date(2026, 7, day, 12, 0),
		hands: "HT",
		drill: null,
		quality: 5,
		effort: 3,
		achievedBpm: 116,
		...over,
	};
}

function entry(over: Partial<ModeEntry> = {}): ModeEntry {
	return { hands: "HT", drill: null, bpm: 116, quality: 5, effort: 3, ...over };
}

function dismissal(over: Partial<PhaseTransition> = {}): PhaseTransition {
	return {
		fromPhase: "learning",
		toPhase: "learning",
		trigger: "advance-button",
		outcome: "dismissed",
		achievedBpmAtEvent: null,
		qualityAtEvent: null,
		daysInPriorPhase: null,
		sessionId: null,
		date: NOW,
		...over,
	};
}

function decide(
	over: Partial<PhaseOfferInput> & {
		phase?: SectionPhase;
		targetTempoBpm?: number | null;
		phaseChangedAt?: Date | null;
	} = {},
) {
	const {
		phase = "learning",
		targetTempoBpm = TARGET,
		phaseChangedAt = null,
		...rest
	} = over;
	const byMode: ByMode = { HT: { bpm: 116, quality: 5, effort: 3 } };
	return decidePhaseOffer({
		section: makeSection({ id: "s1", pieceId: "p1", phase, phaseChangedAt }),
		piece: makePiece({ id: "p1", targetTempoBpm }),
		byMode,
		// One clean day already in history; the save adds today's.
		priorLogs: [log(7)],
		savedEntries: [entry()],
		savedAt: NOW,
		transitions: [],
		now: NOW,
		...rest,
	});
}

describe("decidePhaseOffer", () => {
	it("offers the advance when the criteria are met", () => {
		const { offer, status } = decide();
		expect(status).toBeNull();
		expect(offer).toMatchObject({
			kind: "advance",
			fromPhase: "learning",
			toPhase: "stabilizing",
			htBpm: 116,
			cleanDays: 2,
			cyclingDays: null,
		});
	});

	it("counts the save in progress as one of the clean days", () => {
		// Without today's entry there is only one clean day in the fetched window.
		const { offer } = decide({ savedEntries: [] });
		expect(offer).toBeNull();
	});

	it("offers the demote and never an advance at the same time", () => {
		const { offer } = decide({
			phase: "maintenance",
			savedEntries: [entry({ quality: 1 })],
		});
		expect(offer).toMatchObject({
			kind: "demote",
			fromPhase: "maintenance",
			toPhase: "stabilizing",
			demoteReason: { kind: "low-quality", quality: 1 },
		});
	});

	it("does not compare the saved tempo against itself", () => {
		// A 116 BPM save with no earlier HT tempo has nothing to have dropped from.
		const { offer } = decide({
			phase: "maintenance",
			priorLogs: [],
			savedEntries: [entry({ bpm: 116 })],
		});
		expect(offer?.kind).not.toBe("demote");
	});

	it("carries the cycling-guard age when the phase moved recently", () => {
		const { offer } = decide({ phaseChangedAt: new Date(2026, 7, 6, 12, 0) });
		expect(offer?.cyclingDays).toBe(2);
	});

	it("drops the offer for a status line once suppressed", () => {
		const { offer, status } = decide({
			transitions: [
				dismissal({ date: new Date(2026, 7, 7, 12, 0) }),
				dismissal({ date: new Date(2026, 7, 6, 12, 0) }),
				dismissal({ date: new Date(2026, 7, 5, 12, 0) }),
			],
		});
		expect(offer).toBeNull();
		expect(status).toEqual({ kind: "suppressed" });
	});

	it("ignores dismissals of the other direction", () => {
		const { offer } = decide({
			transitions: [
				dismissal({ trigger: "demote-button" }),
				dismissal({ trigger: "demote-button" }),
				dismissal({ trigger: "demote-button" }),
			],
		});
		expect(offer?.kind).toBe("advance");
	});

	it("suppresses a demote offer on its own dismissal count", () => {
		const { offer, status } = decide({
			phase: "maintenance",
			savedEntries: [entry({ quality: 1 })],
			transitions: [
				dismissal({ trigger: "demote-button" }),
				dismissal({ trigger: "demote-button" }),
				dismissal({ trigger: "demote-button" }),
			],
		});
		expect(offer).toBeNull();
		expect(status).toEqual({ kind: "suppressed" });
	});

	it("shows the one failing criterion", () => {
		const { offer, status } = decide({ priorLogs: [] });
		expect(offer).toBeNull();
		expect(status).toEqual({
			kind: "criterion",
			criterion: { kind: "clean-days", count: 1, required: 2 },
		});
	});

	it("stays silent when the section is two criteria away", () => {
		const { offer, status } = decide({
			byMode: { HT: { bpm: 50 } },
			priorLogs: [],
			savedEntries: [entry({ bpm: 50 })],
		});
		expect(offer).toBeNull();
		expect(status).toBeNull();
	});

	it("always names a missing target, however far off the rest is", () => {
		const { status } = decide({
			targetTempoBpm: null,
			byMode: {},
			priorLogs: [],
			savedEntries: [],
		});
		expect(status).toEqual({
			kind: "criterion",
			criterion: { kind: "no-target" },
		});
	});

	it("says nothing about a target on a maintenance section", () => {
		const { offer, status } = decide({
			phase: "maintenance",
			targetTempoBpm: null,
		});
		expect(offer).toBeNull();
		expect(status).toBeNull();
	});

	it("says nothing for a section with no id", () => {
		const result = decidePhaseOffer({
			section: makeSection({ id: "", pieceId: "p1" }),
			piece: makePiece({ id: "p1", targetTempoBpm: TARGET }),
			byMode: { HT: { bpm: 116 } },
			priorLogs: [log(7)],
			savedEntries: [entry()],
			savedAt: NOW,
			transitions: [],
			now: NOW,
		});
		expect(result).toEqual({ offer: null, status: null });
	});
});
