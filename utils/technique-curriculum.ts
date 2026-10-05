import type { HandsMode } from "@/models/practice";
import type { BlockExecutionState, PlannedBlock } from "@/models/session";
import type { TechniqueItem } from "@/models/technique";
import { dayKey } from "./day-boundary";
import {
	CLEAN_DAY_MIN_QUALITY,
	type ProgressionLog,
} from "./section-progression";

/** Distinct clean days after which an Active technique counts as secure. */
export const CLEAN_DAYS_SECURE = 3;

/** Practice logs read per technique: enough for three clean days of every mode. */
export const CURRICULUM_LOG_LIMIT = 60;

export const SNOOZE_DAYS = [7, 14, 30] as const;
export const DEFAULT_SNOOZE_DAYS = 14;

export interface TechniqueNudge {
	cleanDays: number;
	bpm: number | null;
	next: TechniqueItem | null;
}

export function cleanTechniqueDays(
	tech: TechniqueItem,
	logs: ProgressionLog[],
): number {
	// A full window may have cut the oldest day short, so that day is not judged.
	const cutDay =
		logs.length >= CURRICULUM_LOG_LIMIT
			? dayKey(new Date(Math.min(...logs.map((l) => l.date.getTime()))))
			: null;
	const days = new Map<string, ProgressionLog[]>();
	for (const log of logs) {
		const key = dayKey(log.date);
		if (
			key === cutDay ||
			log.drill ||
			log.date.getTime() < tech.dateIntroduced.getTime()
		) {
			continue;
		}
		days.set(key, [...(days.get(key) ?? []), log]);
	}

	const target = tech.targetTempoBpm;
	const reached = (day: ProgressionLog[], hands: HandsMode) =>
		day.some(
			(l) =>
				(l.hands ?? "HT") === hands && (l.achievedBpm ?? 0) >= (target ?? 0),
		);
	const atTarget = (day: ProgressionLog[]) =>
		!target ||
		((tech.handsMode ?? "separate") === "separate"
			? reached(day, "LH") && reached(day, "RH")
			: reached(day, "HT"));

	return [...days.values()].filter(
		(day) =>
			day.every((l) => (l.quality ?? 0) >= CLEAN_DAY_MIN_QUALITY) &&
			atTarget(day),
	).length;
}

/** Not started techniques, oldest added first, title breaking ties. */
export function notStartedQueue(techniques: TechniqueItem[]): TechniqueItem[] {
	return techniques
		.filter((t) => t.state === "not_started")
		.sort(
			(a, b) =>
				a.dateIntroduced.getTime() - b.dateIntroduced.getTime() ||
				a.title.localeCompare(b.title),
		);
}

export function nextNotStarted(
	techniques: TechniqueItem[],
): TechniqueItem | null {
	return notStartedQueue(techniques)[0] ?? null;
}

export function techniqueNudge(
	tech: TechniqueItem,
	techniques: TechniqueItem[],
	logs: ProgressionLog[],
	now: Date,
): TechniqueNudge | null {
	if (tech.state !== "active") return null;
	if (
		tech.nudgeSnoozedUntil &&
		tech.nudgeSnoozedUntil.getTime() > now.getTime()
	) {
		return null;
	}
	const cleanDays = cleanTechniqueDays(tech, logs);
	if (cleanDays < CLEAN_DAYS_SECURE) return null;
	return {
		cleanDays,
		bpm: tech.targetTempoBpm ?? null,
		next: nextNotStarted(techniques),
	};
}

/** Techniques from the session's completed technique blocks, in plan order. */
export function completedTechniqueIds(
	blocks: PlannedBlock[],
	states: BlockExecutionState[],
): string[] {
	const ids = blocks
		.filter(
			(b, i) =>
				b.kind === "technique" &&
				!!b.techniqueId &&
				states[i]?.status === "completed",
		)
		.map((b) => b.techniqueId as string);
	return [...new Set(ids)];
}

/**
 * The one technique card a session summary shows: none when a section card is
 * already there, since pieces win; otherwise the first practised technique
 * that is secure.
 */
export function summaryTechniqueNudge(
	techniqueIds: string[],
	techniques: TechniqueItem[],
	logsById: Record<string, ProgressionLog[]>,
	hasSectionNudge: boolean,
	now: Date,
): { tech: TechniqueItem & { id: string }; nudge: TechniqueNudge } | null {
	if (hasSectionNudge) return null;
	for (const id of techniqueIds) {
		const tech = techniques.find((t) => t.id === id);
		const logs = logsById[id];
		if (!tech || !logs) continue;
		const nudge = techniqueNudge(tech, techniques, logs, now);
		if (nudge) return { tech: { ...tech, id }, nudge };
	}
	return null;
}
