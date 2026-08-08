import type { Piece } from "@/models/piece";
import type { ByMode, HandsMode, PracticeDrill } from "@/models/practice";
import type {
	PhaseTransition,
	PhaseTransitionTrigger,
	Section,
	SectionPhase,
} from "@/models/section";
import { dayKey } from "./day-boundary";
import { hsTarget, type ModeEntry } from "./practice-modes";

/**
 * Section progression nudges — the criteria engine.
 *
 * Pure: no Firestore, no React. See `docs/specs/section-progression-nudges.md`
 * §3 for the rules and the pedagogy behind each number.
 */

// ---------------------------------------------------------------------------
// Thresholds. One constant per number so each is testable and tunable alone.
// ---------------------------------------------------------------------------

/** `learning → stabilizing` accepts 95% of target — the last 5 BPM is a
 * stabilizing problem, not a learning problem. */
export const ADVANCE_HT_RATIO_STABILIZING = 0.95;

/** `stabilizing → maintenance` gets no discount. Maintenance means done. */
export const ADVANCE_HT_RATIO_MAINTENANCE = 1;

/** Distinct clean HT days required for `learning → stabilizing`. */
export const CLEAN_DAYS_STABILIZING = 2;

/** Distinct clean HT days required for `stabilizing → maintenance`. */
export const CLEAN_DAYS_MAINTENANCE = 3;

/** A day is clean only when every plain HT log on it rates at least this. */
export const CLEAN_DAY_MIN_QUALITY = 4;

/** A mode logged below this fraction of its own previous BPM offers a demote. */
export const DEMOTE_BPM_DROP_RATIO = 0.85;

/** A mode logged at or below this quality offers a demote. */
export const DEMOTE_MAX_QUALITY = 2;

/** Maximum effort paired with at most this quality offers a demote. */
export const DEMOTE_STRAINED_MAX_QUALITY = 3;

/** Effort value that counts as maxed out. */
export const DEMOTE_MAX_EFFORT = 5;

/** Dismissals of the same offer since the last accepted change before it hides. */
export const SUPPRESSION_DISMISSAL_COUNT = 3;

/** How long a suppressed offer stays hidden. */
export const SUPPRESSION_DAYS = 7;

/** A phase changed within this many days makes the next offer carry a warning. */
export const CYCLING_GUARD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/**
 * The part of a practice log the criteria read. Structurally satisfied by
 * `NormalizedLastLog` from `hooks/use-last-practice-log.ts`.
 */
export interface ProgressionLog {
	date: Date;
	hands?: HandsMode | null;
	drill?: PracticeDrill | null;
	quality?: 1 | 2 | 3 | 4 | 5 | null;
	effort?: 1 | 2 | 3 | 4 | 5 | null;
	achievedBpm?: number | null;
}

/** One calendar day's worth of plain HT logs. */
export interface HtDay {
	/** `YYYY-MM-DD` in the student's local timezone, 3am cutoff. */
	key: string;
	/** Every plain HT log on that day. */
	logs: ProgressionLog[];
	/** Highest `achievedBpm` that day; null when the day logged no tempo. */
	maxBpm: number | null;
	/** True when every log on the day rates at least `CLEAN_DAY_MIN_QUALITY`. */
	clean: boolean;
}

/** Why an advance is not (yet) offered. Drives the §3.6 status line. */
export type AdvanceCriterion =
	| { kind: "no-target" }
	| { kind: "ht-tempo"; current: number | null; required: number }
	| {
			kind: "hands-separate";
			hands: HandsMode;
			current: number | null;
			required: number;
	  }
	| { kind: "clean-days"; count: number; required: number }
	| { kind: "bpm-trend" };

export interface AdvanceEvaluation {
	eligible: boolean;
	/** The phase the offer would move to; null when there is nothing above. */
	toPhase: SectionPhase | null;
	failing: AdvanceCriterion[];
	/** HT tempo the offer would quote, for the copy and the audit row. */
	htBpm: number | null;
	/** Clean days achieved, for the copy and the status line. */
	cleanDays: number;
}

/** Why a demote is offered. */
export type DemoteReason =
	| { kind: "bpm-drop"; hands: HandsMode; bpm: number; previousBpm: number }
	| { kind: "low-quality"; hands: HandsMode; quality: number }
	| { kind: "strain"; hands: HandsMode; quality: number; effort: number };

export interface DemoteEvaluation {
	eligible: boolean;
	toPhase: SectionPhase | null;
	reason: DemoteReason | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The target the section is measured against, or null when none is set. */
export function effectiveTargetBpm(
	section: Pick<Section, "targetBpmOverride">,
	piece: Pick<Piece, "targetTempoBpm"> | null | undefined,
): number | null {
	return section.targetBpmOverride ?? piece?.targetTempoBpm ?? null;
}

/**
 * The hands of a plain (non-drill) log, or null for a drill log. Logs written
 * before the hands axis existed are hands-together by convention, matching
 * `logModeKey`.
 */
function plainHands(log: ProgressionLog): HandsMode | null {
	if (log.drill) return null;
	return log.hands ?? "HT";
}

/** Whole days between two moments, floored. */
export function daysBetween(from: Date, to: Date): number {
	return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Group the plain HT logs by calendar day, newest day first. Drill logs and
 * hands-separate logs are ignored — a staccato tempo is not the section's
 * tempo, and hands-together is the integration step these gates certify.
 */
export function groupHtDays(logs: ProgressionLog[]): HtDay[] {
	const byKey = new Map<string, ProgressionLog[]>();
	for (const log of logs) {
		if (plainHands(log) !== "HT") continue;
		const key = dayKey(log.date);
		const bucket = byKey.get(key);
		if (bucket) bucket.push(log);
		else byKey.set(key, [log]);
	}

	return [...byKey.entries()]
		.sort((a, b) => b[0].localeCompare(a[0]))
		.map(([key, dayLogs]) => {
			const bpms = dayLogs
				.map((l) => l.achievedBpm)
				.filter((b): b is number => b != null);
			return {
				key,
				logs: dayLogs,
				maxBpm: bpms.length > 0 ? Math.max(...bpms) : null,
				clean: dayLogs.every((l) => (l.quality ?? 0) >= CLEAN_DAY_MIN_QUALITY),
			};
		});
}

/**
 * §3.1 — the most recent `n` distinct days with a plain HT log must all be
 * clean. `count` is how many clean days the section has running back from the
 * newest, capped at `n`, so the status line can say "1 of 2".
 *
 * Missing history is unmet, never assumed: a section with no HT logs cannot
 * advance, and there is no hands-separate fallback.
 */
export function cleanHtDays(
	logs: ProgressionLog[],
	n: number,
): { met: boolean; count: number; days: HtDay[] } {
	const days = groupHtDays(logs);
	let count = 0;
	while (count < n && count < days.length && days[count].clean) count++;
	// Oldest → newest, so callers can read the sequence forwards.
	return { met: count >= n, count, days: days.slice(0, n).reverse() };
}

/** §3.3.4 — day tempos, oldest → newest, must never step backwards. */
export function isTempoNonDecreasing(days: HtDay[]): boolean {
	const bpms = days.map((d) => d.maxBpm).filter((b): b is number => b != null);
	return bpms.every((bpm, i) => i === 0 || bpm >= bpms[i - 1]);
}

/** The phase an advance from `phase` would land on. */
export function nextPhase(phase: SectionPhase): SectionPhase | null {
	if (phase === "learning") return "stabilizing";
	if (phase === "stabilizing") return "maintenance";
	return null;
}

/** The phase a demote from `phase` would land on. */
export function previousPhase(phase: SectionPhase): SectionPhase | null {
	if (phase === "maintenance") return "stabilizing";
	if (phase === "stabilizing") return "learning";
	return null;
}

// ---------------------------------------------------------------------------
// Advance
// ---------------------------------------------------------------------------

/**
 * §3.2 / §3.3 — whether the section has earned the next phase.
 *
 * `byMode` is passed separately from `section` so the caller can hand in the
 * map it just merged rather than the stale stored one. `logs` must already
 * include the entries written by the save in progress.
 */
export function evaluateAdvance(
	section: Pick<Section, "phase" | "targetBpmOverride">,
	piece: Pick<Piece, "targetTempoBpm"> | null | undefined,
	byMode: ByMode | null | undefined,
	logs: ProgressionLog[],
): AdvanceEvaluation {
	const toPhase = nextPhase(section.phase);
	const htBpm = byMode?.HT?.bpm ?? null;
	if (!toPhase) {
		return { eligible: false, toPhase: null, failing: [], htBpm, cleanDays: 0 };
	}

	const target = effectiveTargetBpm(section, piece);
	if (target == null) {
		return {
			eligible: false,
			toPhase,
			failing: [{ kind: "no-target" }],
			htBpm,
			cleanDays: 0,
		};
	}

	const failing: AdvanceCriterion[] = [];
	const ratio =
		toPhase === "stabilizing"
			? ADVANCE_HT_RATIO_STABILIZING
			: ADVANCE_HT_RATIO_MAINTENANCE;
	const requiredHt = target * ratio;
	if (htBpm == null || htBpm < requiredHt) {
		failing.push({ kind: "ht-tempo", current: htBpm, required: requiredHt });
	}

	// Hands-separate is proven at the learning gate only; the maintenance gate
	// does not re-check it.
	if (toPhase === "stabilizing") {
		const requiredHs = hsTarget(target) ?? 0;
		for (const hands of ["LH", "RH"] as HandsMode[]) {
			// A mode never practised is not required. One that has been practised
			// and lags — or was rated without a tempo — blocks the advance.
			if (!byMode?.[hands]) continue;
			const bpm = byMode[hands].bpm ?? null;
			if (bpm == null || bpm < requiredHs) {
				failing.push({
					kind: "hands-separate",
					hands,
					current: bpm,
					required: requiredHs,
				});
			}
		}
	}

	const requiredDays =
		toPhase === "stabilizing" ? CLEAN_DAYS_STABILIZING : CLEAN_DAYS_MAINTENANCE;
	const clean = cleanHtDays(logs, requiredDays);
	if (!clean.met) {
		failing.push({
			kind: "clean-days",
			count: clean.count,
			required: requiredDays,
		});
	}

	if (
		toPhase === "maintenance" &&
		clean.met &&
		!isTempoNonDecreasing(clean.days)
	) {
		failing.push({ kind: "bpm-trend" });
	}

	return {
		eligible: failing.length === 0,
		toPhase,
		failing,
		htBpm,
		cleanDays: clean.count,
	};
}

// ---------------------------------------------------------------------------
// Demote
// ---------------------------------------------------------------------------

/** Newest earlier tempo logged for the same mode key, or null. */
function previousBpmForMode(
	priorLogs: ProgressionLog[],
	hands: HandsMode,
): number | null {
	let newest: ProgressionLog | null = null;
	for (const log of priorLogs) {
		if (plainHands(log) !== hands) continue;
		if (log.achievedBpm == null) continue;
		if (!newest || log.date.getTime() > newest.date.getTime()) newest = log;
	}
	return newest?.achievedBpm ?? null;
}

/**
 * §3.4 — whether the session just saved is evidence the section has slipped.
 *
 * `priorLogs` must be the history *before* this save: the BPM rule compares the
 * saved entry against the newest earlier log for the same mode.
 */
export function evaluateDemote(
	section: Pick<Section, "phase">,
	savedEntries: ModeEntry[],
	priorLogs: ProgressionLog[],
): DemoteEvaluation {
	const toPhase = previousPhase(section.phase);
	if (!toPhase) return { eligible: false, toPhase: null, reason: null };

	const plain = savedEntries.filter((e) => !e.drill);

	// Ordered by how much the reason tells the student, not by severity.
	for (const entry of plain) {
		if (entry.bpm == null) continue;
		const previous = previousBpmForMode(priorLogs, entry.hands);
		if (previous == null) continue;
		if (entry.bpm < DEMOTE_BPM_DROP_RATIO * previous) {
			return {
				eligible: true,
				toPhase,
				reason: {
					kind: "bpm-drop",
					hands: entry.hands,
					bpm: entry.bpm,
					previousBpm: previous,
				},
			};
		}
	}

	for (const entry of plain) {
		if (entry.quality <= DEMOTE_MAX_QUALITY) {
			return {
				eligible: true,
				toPhase,
				reason: {
					kind: "low-quality",
					hands: entry.hands,
					quality: entry.quality,
				},
			};
		}
	}

	for (const entry of plain) {
		if (
			entry.effort === DEMOTE_MAX_EFFORT &&
			entry.quality <= DEMOTE_STRAINED_MAX_QUALITY
		) {
			return {
				eligible: true,
				toPhase,
				reason: {
					kind: "strain",
					hands: entry.hands,
					quality: entry.quality,
					effort: entry.effort,
				},
			};
		}
	}

	return { eligible: false, toPhase, reason: null };
}

// ---------------------------------------------------------------------------
// Suppression and the cycling guard
// ---------------------------------------------------------------------------

/**
 * §3.5 — hide an offer the student has waved away three times since they last
 * accepted one, until a week has passed. Not a permanent mute: after
 * `SUPPRESSION_DAYS` the offer comes back.
 *
 * `transitions` may be in any order; only rows for `trigger` are counted, and
 * any accepted row (whatever its trigger) resets the tally.
 */
export function isSuppressed(
	transitions: PhaseTransition[],
	trigger: PhaseTransitionTrigger,
	now: Date,
): boolean {
	const sorted = [...transitions].sort(
		(a, b) => b.date.getTime() - a.date.getTime(),
	);

	let count = 0;
	let newest: Date | null = null;
	for (const t of sorted) {
		if (t.outcome === "accepted") break;
		if (t.trigger !== trigger) continue;
		count++;
		if (!newest) newest = t.date;
	}

	if (count < SUPPRESSION_DISMISSAL_COUNT || !newest) return false;
	return daysBetween(newest, now) < SUPPRESSION_DAYS;
}

/**
 * §3.5 — a phase changed less than a week ago earns a "you just moved this"
 * warning on the next offer. A warning, never a block.
 */
export function cyclingGuardDays(
	phaseChangedAt: Date | null | undefined,
	now: Date,
): number | null {
	if (!phaseChangedAt) return null;
	const days = daysBetween(phaseChangedAt, now);
	if (days < 0 || days >= CYCLING_GUARD_DAYS) return null;
	return days;
}
