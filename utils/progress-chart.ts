import {
	HANDS_MODES,
	type HandsMode,
	PracticeMistakes,
} from "@/models/practice";
import type { NormalizedLastLog } from "@/utils/practice-history";

export const CHART_LOG_CAP = 500;

export type AccuracyLevel = "clean" | "slips" | "shaky";
export type ChartKind =
	| "section"
	| "technique"
	| "run-through"
	| "sight-reading";
export type ChartRange = "1m" | "3m" | "1y" | "all";
export interface ChartLog extends NormalizedLastLog {
	keptGoing?: 1 | 2 | 3 | 4 | 5 | null;
}
export interface ChartPoint {
	date: Date;
	bpm: number;
	accuracy: AccuracyLevel;
}
export interface ChartSeries {
	hands: HandsMode | null;
	points: ChartPoint[];
}

export function accuracyLevel(log: ChartLog, kind: ChartKind): AccuracyLevel {
	if (kind === "run-through") {
		const worst = Math.max(
			log.technicalMistakes ?? PracticeMistakes.none,
			log.memoryMistakes ?? PracticeMistakes.none,
		);
		return worst >= PracticeMistakes.many
			? "shaky"
			: worst === PracticeMistakes.some
				? "slips"
				: "clean";
	}
	const value = kind === "sight-reading" ? log.keptGoing : log.quality;
	return value == null || value >= 4
		? "clean"
		: value === 3
			? "slips"
			: "shaky";
}

export function lineWidth(level: AccuracyLevel): number {
	return { clean: 1, slips: 2, shaky: 4 }[level];
}

export function rangeStart(range: ChartRange, now: Date): Date | null {
	if (range === "all") return null;
	const months = range === "1m" ? 1 : range === "3m" ? 3 : 12;
	const start = new Date(now.getFullYear(), now.getMonth() - months, 1);
	const lastDay = new Date(
		start.getFullYear(),
		start.getMonth() + 1,
		0,
	).getDate();
	start.setDate(Math.min(now.getDate(), lastDay));
	return start;
}

export function buildSeries(
	logs: readonly ChartLog[],
	kind: ChartKind,
): ChartSeries[] {
	const groups = new Map<HandsMode | null, ChartPoint[]>();
	for (const log of logs) {
		if (
			typeof log.achievedBpm !== "number" ||
			!Number.isFinite(log.achievedBpm) ||
			log.drill
		)
			continue;
		const hands =
			kind === "run-through" || kind === "sight-reading"
				? null
				: (log.hands ?? "HT");
		const points = groups.get(hands) ?? [];
		points.push({
			date: log.date,
			bpm: log.achievedBpm,
			accuracy: accuracyLevel(log, kind),
		});
		groups.set(hands, points);
	}
	return [...groups]
		.sort(
			([a], [b]) =>
				HANDS_MODES.indexOf(a as HandsMode) -
				HANDS_MODES.indexOf(b as HandsMode),
		)
		.map(([hands, points]) => ({
			hands,
			points: points.sort((a, b) => a.date.getTime() - b.date.getTime()),
		}));
}

export function yDomain(
	series: readonly ChartSeries[],
	target?: number | null,
): [number, number] {
	const values = series.flatMap(({ points }) => points.map(({ bpm }) => bpm));
	if (target != null) values.push(target);
	if (!values.length) return [0, 10];
	const low = Math.min(...values);
	const high = Math.max(...values);
	return [(Math.ceil(low / 10) - 1) * 10, (Math.floor(high / 10) + 1) * 10];
}

export function monthTicks(
	start: Date,
	end: Date,
	locale: string,
): { date: Date; label: string }[] {
	const formatter = new Intl.DateTimeFormat(locale, { month: "short" });
	const ticks: { date: Date; label: string }[] = [];
	const date = new Date(start.getFullYear(), start.getMonth(), 1);
	if (date < start) date.setMonth(date.getMonth() + 1);
	while (date <= end) {
		ticks.push({ date: new Date(date), label: formatter.format(date) });
		date.setMonth(date.getMonth() + 1);
	}
	return ticks;
}

export function summarise(
	series: readonly ChartSeries[],
	target?: number | null,
) {
	return series.map(({ hands, points }) => {
		const counts = { shaky: 0, slips: 0, clean: 0, total: points.length };
		for (const point of points) counts[point.accuracy]++;
		const currentBpm = points.at(-1)?.bpm ?? null;
		return {
			hands,
			currentBpm,
			gap:
				target == null || currentBpm == null
					? null
					: Math.max(0, target - currentBpm),
			counts,
		};
	});
}
