import type { HandsMode } from "@/models/practice";
import type { TechniqueItem } from "@/models/technique";
import { dayKey } from "./day-boundary";
import {
	CLEAN_DAY_MIN_QUALITY,
	type ProgressionLog,
} from "./section-progression";

/** Distinct clean days after which an Active technique counts as secure. */
export const CLEAN_DAYS_SECURE = 3;

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
	const days = new Map<string, ProgressionLog[]>();
	for (const log of logs) {
		if (log.drill || log.date.getTime() < tech.dateIntroduced.getTime()) {
			continue;
		}
		const key = dayKey(log.date);
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

export function nextNotStarted(
	techniques: TechniqueItem[],
): TechniqueItem | null {
	return (
		techniques
			.filter((t) => t.state === "not_started")
			.sort(
				(a, b) =>
					a.dateIntroduced.getTime() - b.dateIntroduced.getTime() ||
					a.title.localeCompare(b.title),
			)[0] ?? null
	);
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
