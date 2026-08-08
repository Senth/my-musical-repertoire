import type { ByMode } from "@/models/practice";
import type {
	PhaseTransition,
	PhaseTransitionTrigger,
	SectionPhase,
} from "@/models/section";
import { hsTarget, type ModeEntry } from "./practice-modes";
import {
	ADVANCE_HT_RATIO_STABILIZING,
	CLEAN_DAY_MIN_QUALITY,
	CLEAN_DAYS_MAINTENANCE,
	CLEAN_DAYS_STABILIZING,
	CYCLING_GUARD_DAYS,
	cleanHtDays,
	cyclingGuardDays,
	DEMOTE_BPM_DROP_RATIO,
	effectiveTargetBpm,
	evaluateAdvance,
	evaluateDemote,
	groupHtDays,
	isSuppressed,
	isTempoNonDecreasing,
	nextPhase,
	type ProgressionLog,
	previousPhase,
	SUPPRESSION_DAYS,
	SUPPRESSION_DISMISSAL_COUNT,
} from "./section-progression";
import { makePiece, makeSection } from "./test-factories";

const TARGET = 120;
const HS_TARGET = 138; // round(120 × 1.15)
const NOW = new Date(2026, 7, 8, 12, 0);

/** A log on day `d` of August 2026 at midday. */
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

/** Newest-first history of `count` clean HT days ending on Aug 7. */
function cleanDays(count: number, over: Partial<ProgressionLog> = {}) {
	return Array.from({ length: count }, (_, i) => log(7 - i, over));
}

function mode(bpm: number | null): ByMode[string] {
	return { bpm, quality: 5, effort: 3, lastPracticed: NOW };
}

function advance({
	phase = "learning" as SectionPhase,
	targetBpmOverride = null as number | null,
	targetTempoBpm = TARGET as number | null,
	byMode = { HT: mode(116) } as ByMode | null,
	logs = cleanDays(CLEAN_DAYS_STABILIZING),
}: {
	phase?: SectionPhase;
	targetBpmOverride?: number | null;
	targetTempoBpm?: number | null;
	byMode?: ByMode | null;
	logs?: ProgressionLog[];
} = {}) {
	return evaluateAdvance(
		makeSection({ id: "s1", pieceId: "p1", phase, targetBpmOverride }),
		makePiece({ id: "p1", targetTempoBpm }),
		byMode,
		logs,
	);
}

function entry(over: Partial<ModeEntry> = {}): ModeEntry {
	return { hands: "HT", drill: null, bpm: 120, quality: 4, effort: 3, ...over };
}

function demote(
	phase: SectionPhase,
	entries: ModeEntry[],
	priorLogs: ProgressionLog[] = [],
) {
	return evaluateDemote(
		makeSection({ id: "s1", pieceId: "p1", phase }),
		entries,
		priorLogs,
	);
}

function transition(over: Partial<PhaseTransition>): PhaseTransition {
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

/** `n` dismissals of `trigger`, the newest `ageDays` old, one per day. */
function dismissals(
	n: number,
	trigger: PhaseTransitionTrigger = "advance-button",
	ageDays = 0,
): PhaseTransition[] {
	return Array.from({ length: n }, (_, i) =>
		transition({
			trigger,
			date: new Date(2026, 7, 8 - ageDays - i, 12, 0),
		}),
	);
}

describe("effectiveTargetBpm", () => {
	it("prefers the section override over the piece target", () => {
		const section = makeSection({
			id: "s1",
			pieceId: "p1",
			targetBpmOverride: 90,
		});
		expect(
			effectiveTargetBpm(section, makePiece({ id: "p1", targetTempoBpm: 120 })),
		).toBe(90);
	});

	it("falls back to the piece target, then to null", () => {
		const section = makeSection({ id: "s1", pieceId: "p1" });
		expect(
			effectiveTargetBpm(section, makePiece({ id: "p1", targetTempoBpm: 120 })),
		).toBe(120);
		expect(effectiveTargetBpm(section, makePiece({ id: "p1" }))).toBeNull();
		expect(effectiveTargetBpm(section, null)).toBeNull();
	});
});

describe("nextPhase / previousPhase", () => {
	it("walks the ladder and stops at both ends", () => {
		expect(nextPhase("learning")).toBe("stabilizing");
		expect(nextPhase("stabilizing")).toBe("maintenance");
		expect(nextPhase("maintenance")).toBeNull();
		expect(previousPhase("maintenance")).toBe("stabilizing");
		expect(previousPhase("stabilizing")).toBe("learning");
		expect(previousPhase("learning")).toBeNull();
	});
});

describe("groupHtDays", () => {
	it("groups plain HT logs newest day first", () => {
		const days = groupHtDays([log(7), log(5), log(5)]);
		expect(days.map((d) => d.key)).toEqual(["2026-08-07", "2026-08-05"]);
		expect(days[1].logs).toHaveLength(2);
	});

	it("ignores drill logs — a staccato tempo is not the section's tempo", () => {
		const days = groupHtDays([log(7, { drill: "staccato", quality: 1 })]);
		expect(days).toHaveLength(0);
	});

	it("ignores hands-separate logs", () => {
		const days = groupHtDays([
			log(7, { hands: "LH" }),
			log(6, { hands: "RH" }),
		]);
		expect(days).toHaveLength(0);
	});

	it("treats a log with no hands as hands-together", () => {
		const days = groupHtDays([log(7, { hands: null })]);
		expect(days).toHaveLength(1);
	});

	it("takes the day's highest achievedBpm and null when none was logged", () => {
		const days = groupHtDays([
			log(7, { achievedBpm: 100 }),
			log(7, { achievedBpm: 130 }),
			log(6, { achievedBpm: null }),
		]);
		expect(days[0].maxBpm).toBe(130);
		expect(days[1].maxBpm).toBeNull();
	});

	it("marks a day dirty when any of its logs is below the quality bar", () => {
		const days = groupHtDays([
			log(7, { quality: 5 }),
			log(7, { quality: (CLEAN_DAY_MIN_QUALITY - 1) as 1 | 2 | 3 | 4 | 5 }),
		]);
		expect(days[0].clean).toBe(false);
	});

	it("treats an unrated log as dirty", () => {
		expect(groupHtDays([log(7, { quality: null })])[0].clean).toBe(false);
	});

	it("puts a late-night log on the previous day", () => {
		const days = groupHtDays([
			{ date: new Date(2026, 7, 7, 23, 0), hands: "HT", quality: 5 },
			{ date: new Date(2026, 7, 8, 1, 0), hands: "HT", quality: 5 },
		]);
		expect(days).toHaveLength(1);
		expect(days[0].key).toBe("2026-08-07");
	});
});

describe("cleanHtDays", () => {
	it("is met when the newest N distinct days are all clean", () => {
		const result = cleanHtDays(cleanDays(2), 2);
		expect(result.met).toBe(true);
		expect(result.count).toBe(2);
	});

	it("counts non-consecutive calendar days", () => {
		const result = cleanHtDays([log(7), log(1)], 2);
		expect(result.met).toBe(true);
	});

	it("counts two logs on one day as one day", () => {
		const result = cleanHtDays([log(7), log(7)], 2);
		expect(result.met).toBe(false);
		expect(result.count).toBe(1);
	});

	it("fails the day when one of its two logs is bad", () => {
		const result = cleanHtDays([log(7, { quality: 2 }), log(7), log(6)], 2);
		expect(result.met).toBe(false);
		expect(result.count).toBe(0);
	});

	it("stops counting at the first dirty day", () => {
		const result = cleanHtDays([log(7), log(6, { quality: 2 }), log(5)], 3);
		expect(result.count).toBe(1);
	});

	it("is unmet when the history is shorter than N", () => {
		const result = cleanHtDays(cleanDays(1), 2);
		expect(result.met).toBe(false);
		expect(result.count).toBe(1);
	});

	it("is unmet with no HT history at all — there is no LH/RH fallback", () => {
		const result = cleanHtDays(
			[log(7, { hands: "LH" }), log(6, { hands: "RH" })],
			2,
		);
		expect(result.met).toBe(false);
		expect(result.count).toBe(0);
	});

	it("returns the considered days oldest first", () => {
		const result = cleanHtDays(cleanDays(3), 3);
		expect(result.days.map((d) => d.key)).toEqual([
			"2026-08-05",
			"2026-08-06",
			"2026-08-07",
		]);
	});
});

describe("isTempoNonDecreasing", () => {
	const day = (maxBpm: number | null) => ({
		key: "k",
		logs: [],
		maxBpm,
		clean: true,
	});

	it("accepts a rising sequence", () => {
		expect(isTempoNonDecreasing([day(100), day(110), day(110)])).toBe(true);
	});

	it("rejects a dip", () => {
		expect(isTempoNonDecreasing([day(100), day(120), day(110)])).toBe(false);
	});

	it("skips days that logged no tempo", () => {
		expect(isTempoNonDecreasing([day(100), day(null), day(110)])).toBe(true);
		expect(isTempoNonDecreasing([day(120), day(null), day(110)])).toBe(false);
	});

	it("accepts an all-null sequence", () => {
		expect(isTempoNonDecreasing([day(null), day(null)])).toBe(true);
	});
});

describe("evaluateAdvance — learning → stabilizing", () => {
	it("is eligible when every criterion passes", () => {
		const result = advance();
		expect(result.eligible).toBe(true);
		expect(result.toPhase).toBe("stabilizing");
		expect(result.failing).toEqual([]);
		expect(result.htBpm).toBe(116);
		expect(result.cleanDays).toBe(CLEAN_DAYS_STABILIZING);
	});

	it("accepts exactly 95% of target and rejects a hair under", () => {
		const at = TARGET * ADVANCE_HT_RATIO_STABILIZING;
		expect(advance({ byMode: { HT: mode(at) } }).eligible).toBe(true);
		const under = advance({ byMode: { HT: mode(at - 1) } });
		expect(under.eligible).toBe(false);
		expect(under.failing).toEqual([
			{ kind: "ht-tempo", current: at - 1, required: at },
		]);
	});

	it("fails on HT tempo alone when the section has never been timed", () => {
		const result = advance({ byMode: { HT: mode(null) } });
		expect(result.failing).toEqual([
			{ kind: "ht-tempo", current: null, required: 114 },
		]);
	});

	it("fails on HT tempo when HT was never practised", () => {
		const result = advance({ byMode: {}, logs: [] });
		expect(result.failing).toContainEqual({
			kind: "ht-tempo",
			current: null,
			required: 114,
		});
	});

	it("fails on clean days alone", () => {
		const result = advance({ logs: cleanDays(1) });
		expect(result.eligible).toBe(false);
		expect(result.failing).toEqual([
			{ kind: "clean-days", count: 1, required: CLEAN_DAYS_STABILIZING },
		]);
	});

	it("advances an HT-only section — a mode never practised is not required", () => {
		expect(advance({ byMode: { HT: mode(116) } }).eligible).toBe(true);
	});

	it("is blocked by a practised LH that lags the hands-separate target", () => {
		const result = advance({
			byMode: { HT: mode(116), LH: mode(HS_TARGET - 1) },
		});
		expect(result.eligible).toBe(false);
		expect(result.failing).toEqual([
			{
				kind: "hands-separate",
				hands: "LH",
				current: HS_TARGET - 1,
				required: HS_TARGET,
			},
		]);
	});

	it("accepts a practised LH exactly at the hands-separate target", () => {
		expect(
			advance({ byMode: { HT: mode(116), LH: mode(HS_TARGET) } }).eligible,
		).toBe(true);
	});

	it("is blocked by a mode rated without a tempo", () => {
		const result = advance({ byMode: { HT: mode(116), RH: mode(null) } });
		expect(result.failing).toEqual([
			{
				kind: "hands-separate",
				hands: "RH",
				current: null,
				required: HS_TARGET,
			},
		]);
	});

	it("ignores drill keys when checking hands-separate modes", () => {
		const result = advance({
			byMode: { HT: mode(116), "LH.staccato": mode(40) },
		});
		expect(result.eligible).toBe(true);
	});

	it("ignores drill logs when counting clean days", () => {
		const result = advance({
			logs: [...cleanDays(1), log(6, { drill: "staccato", quality: 5 })],
		});
		expect(result.failing).toEqual([
			{ kind: "clean-days", count: 1, required: CLEAN_DAYS_STABILIZING },
		]);
	});

	it("never advances a section with no HT history", () => {
		const result = advance({
			byMode: { LH: mode(HS_TARGET), RH: mode(HS_TARGET) },
			logs: [log(7, { hands: "LH" }), log(6, { hands: "RH" })],
		});
		expect(result.eligible).toBe(false);
		expect(result.failing).toHaveLength(2);
	});

	it("reports only the missing target when no target is set", () => {
		const result = advance({ targetTempoBpm: null });
		expect(result.eligible).toBe(false);
		expect(result.failing).toEqual([{ kind: "no-target" }]);
	});

	it("uses the section override as the target", () => {
		const result = advance({ targetBpmOverride: 200, targetTempoBpm: 60 });
		expect(result.failing).toEqual([
			{ kind: "ht-tempo", current: 116, required: 190 },
		]);
	});

	it("does not check the tempo trend at this gate", () => {
		const result = advance({
			logs: [log(7, { achievedBpm: 100 }), log(6, { achievedBpm: 130 })],
		});
		expect(result.eligible).toBe(true);
	});
});

describe("evaluateAdvance — stabilizing → maintenance", () => {
	const stabilizing = (over: Parameters<typeof advance>[0] = {}) =>
		advance({
			phase: "stabilizing",
			byMode: { HT: mode(TARGET) },
			logs: cleanDays(CLEAN_DAYS_MAINTENANCE, { achievedBpm: TARGET }),
			...over,
		});

	it("is eligible when every criterion passes", () => {
		const result = stabilizing();
		expect(result.eligible).toBe(true);
		expect(result.toPhase).toBe("maintenance");
	});

	it("gives no discount — 95% of target is not enough", () => {
		const result = stabilizing({ byMode: { HT: mode(114) } });
		expect(result.failing).toEqual([
			{ kind: "ht-tempo", current: 114, required: TARGET },
		]);
	});

	it("needs three clean days, not two", () => {
		const result = stabilizing({
			logs: cleanDays(2, { achievedBpm: TARGET }),
		});
		expect(result.failing).toEqual([
			{ kind: "clean-days", count: 2, required: CLEAN_DAYS_MAINTENANCE },
		]);
	});

	it("does not re-check hands-separate — that was proven at the last gate", () => {
		const result = stabilizing({
			byMode: { HT: mode(TARGET), LH: mode(40) },
		});
		expect(result.eligible).toBe(true);
	});

	it("fails on a sliding tempo alone", () => {
		const result = stabilizing({
			logs: [
				log(7, { achievedBpm: 121 }),
				log(6, { achievedBpm: 130 }),
				log(5, { achievedBpm: 122 }),
			],
		});
		expect(result.eligible).toBe(false);
		expect(result.failing).toEqual([{ kind: "bpm-trend" }]);
	});

	it("skips days with no logged tempo in the trend check", () => {
		const result = stabilizing({
			logs: [
				log(7, { achievedBpm: 130 }),
				log(6, { achievedBpm: null }),
				log(5, { achievedBpm: 122 }),
			],
		});
		expect(result.eligible).toBe(true);
	});
});

describe("evaluateAdvance — maintenance", () => {
	it("offers nothing above maintenance", () => {
		const result = advance({ phase: "maintenance", byMode: { HT: mode(200) } });
		expect(result.eligible).toBe(false);
		expect(result.toPhase).toBeNull();
		expect(result.failing).toEqual([]);
	});
});

describe("evaluateDemote", () => {
	it("never demotes a learning section", () => {
		const result = demote("learning", [entry({ quality: 1 })]);
		expect(result.eligible).toBe(false);
		expect(result.toPhase).toBeNull();
	});

	it.each([
		["stabilizing", "learning"],
		["maintenance", "stabilizing"],
	] as const)("targets %s → %s", (from, to) => {
		expect(demote(from, [entry({ quality: 1 })]).toPhase).toBe(to);
	});

	it("stays quiet on a good session", () => {
		const result = demote(
			"maintenance",
			[entry({ quality: 5, effort: 2 })],
			[log(7, { achievedBpm: 120 })],
		);
		expect(result.eligible).toBe(false);
		expect(result.reason).toBeNull();
	});

	it("offers on a tempo below 85% of the same mode's last tempo", () => {
		const previous = 120;
		const bpm = Math.floor(previous * DEMOTE_BPM_DROP_RATIO) - 1;
		const result = demote(
			"maintenance",
			[entry({ bpm })],
			[log(7, { achievedBpm: previous })],
		);
		expect(result.reason).toEqual({
			kind: "bpm-drop",
			hands: "HT",
			bpm,
			previousBpm: previous,
		});
	});

	it("accepts exactly 85% of the previous tempo", () => {
		const result = demote(
			"maintenance",
			[entry({ bpm: 102 })],
			[log(7, { achievedBpm: 120 })],
		);
		expect(result.eligible).toBe(false);
	});

	it("compares a mode only against itself, never HT against LH", () => {
		const result = demote(
			"maintenance",
			[entry({ hands: "LH", bpm: 100, quality: 4, effort: 3 })],
			[log(7, { hands: "HT", achievedBpm: 200 })],
		);
		expect(result.eligible).toBe(false);
	});

	it("uses the newest earlier log with a tempo, skipping untimed ones", () => {
		const result = demote(
			"maintenance",
			[entry({ bpm: 90 })],
			[log(7, { achievedBpm: null }), log(6, { achievedBpm: 200 })],
		);
		expect(result.reason).toMatchObject({ kind: "bpm-drop", previousBpm: 200 });
	});

	it("stays quiet when the mode has no earlier tempo to compare against", () => {
		expect(demote("maintenance", [entry({ bpm: 10 })], []).eligible).toBe(
			false,
		);
	});

	it("ignores drill history when finding the previous tempo", () => {
		const result = demote(
			"maintenance",
			[entry({ bpm: 100 })],
			[log(7, { drill: "staccato", achievedBpm: 200 })],
		);
		expect(result.eligible).toBe(false);
	});

	it("ignores a drill entry in the save itself", () => {
		const result = demote("maintenance", [
			entry({ drill: "staccato", quality: 1 }),
		]);
		expect(result.eligible).toBe(false);
	});

	it.each([1, 2] as const)("offers on quality %i", (quality) => {
		const result = demote("maintenance", [entry({ quality })]);
		expect(result.reason).toEqual({
			kind: "low-quality",
			hands: "HT",
			quality,
		});
	});

	it("stays quiet on quality 3 alone", () => {
		expect(
			demote("maintenance", [entry({ quality: 3, effort: 4 })]).eligible,
		).toBe(false);
	});

	it("offers on maxed effort with mediocre quality", () => {
		const result = demote("maintenance", [entry({ quality: 3, effort: 5 })]);
		expect(result.reason).toEqual({
			kind: "strain",
			hands: "HT",
			quality: 3,
			effort: 5,
		});
	});

	it("stays quiet on maxed effort with good quality", () => {
		expect(
			demote("maintenance", [entry({ quality: 4, effort: 5 })]).eligible,
		).toBe(false);
	});

	it("fires on any one of several saved modes", () => {
		const result = demote("maintenance", [
			entry({ hands: "LH", quality: 5 }),
			entry({ hands: "RH", quality: 1 }),
		]);
		expect(result.reason).toEqual({
			kind: "low-quality",
			hands: "RH",
			quality: 1,
		});
	});

	it("prefers the tempo drop, which says more than the rating", () => {
		const result = demote(
			"maintenance",
			[entry({ hands: "LH", quality: 1 }), entry({ hands: "HT", bpm: 50 })],
			[log(7, { hands: "HT", achievedBpm: 120 })],
		);
		expect(result.reason).toMatchObject({ kind: "bpm-drop", hands: "HT" });
	});
});

describe("isSuppressed", () => {
	it("stays quiet below the dismissal count", () => {
		const rows = dismissals(SUPPRESSION_DISMISSAL_COUNT - 1);
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(false);
	});

	it("suppresses at the dismissal count", () => {
		const rows = dismissals(SUPPRESSION_DISMISSAL_COUNT);
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(true);
	});

	it("counts only the same trigger", () => {
		const rows = [
			...dismissals(SUPPRESSION_DISMISSAL_COUNT, "demote-button"),
			...dismissals(1),
		];
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(false);
		expect(isSuppressed(rows, "demote-button", NOW)).toBe(true);
	});

	it("resets the tally at an accepted row", () => {
		const rows = [
			...dismissals(2),
			transition({ outcome: "accepted", date: new Date(2026, 7, 1, 12, 0) }),
			...dismissals(SUPPRESSION_DISMISSAL_COUNT, "advance-button", 20),
		];
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(false);
	});

	it("expires once the newest dismissal is a week old", () => {
		const rows = dismissals(
			SUPPRESSION_DISMISSAL_COUNT,
			"advance-button",
			SUPPRESSION_DAYS,
		);
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(false);
	});

	it("still suppresses the day before it expires", () => {
		const rows = dismissals(
			SUPPRESSION_DISMISSAL_COUNT,
			"advance-button",
			SUPPRESSION_DAYS - 1,
		);
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(true);
	});

	it("does not care what order the rows arrive in", () => {
		const rows = [...dismissals(SUPPRESSION_DISMISSAL_COUNT)].reverse();
		expect(isSuppressed(rows, "advance-button", NOW)).toBe(true);
	});

	it("stays quiet with no history", () => {
		expect(isSuppressed([], "advance-button", NOW)).toBe(false);
	});
});

describe("cyclingGuardDays", () => {
	it("is quiet when the phase has never been changed", () => {
		expect(cyclingGuardDays(null, NOW)).toBeNull();
		expect(cyclingGuardDays(undefined, NOW)).toBeNull();
	});

	it("reports the age of a recent change", () => {
		expect(cyclingGuardDays(new Date(2026, 7, 6, 12, 0), NOW)).toBe(2);
	});

	it("is quiet once the change is a week old", () => {
		const old = new Date(2026, 7, 8 - CYCLING_GUARD_DAYS, 12, 0);
		expect(cyclingGuardDays(old, NOW)).toBeNull();
	});

	it("warns on a same-day change", () => {
		expect(cyclingGuardDays(new Date(2026, 7, 8, 9, 0), NOW)).toBe(0);
	});
});

describe("test fixtures", () => {
	it("keeps HS_TARGET in step with HS_TARGET_MULTIPLIER", () => {
		expect(hsTarget(TARGET)).toBe(HS_TARGET);
	});
});
