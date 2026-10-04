import type { TFunction } from "i18next";
import type {
	HandsMode,
	ModeKey,
	PracticeDrill,
	PracticeMistakes,
} from "@/models/practice";
import { HANDS_MODES } from "@/models/practice";
import { dayKey, dayStartCutoff } from "@/utils/day-boundary";
import { modeKey } from "@/utils/practice-modes";
import { RUN_THROUGH_LOG_SOURCE } from "@/utils/run-through-credit";

export interface NormalizedLastLog {
	date: Date;
	technicalMistakes?: PracticeMistakes | null;
	memoryMistakes?: PracticeMistakes | null;
	quality?: 1 | 2 | 3 | 4 | 5 | null;
	effort?: 1 | 2 | 3 | 4 | 5 | null;
	achievedBpm?: number | null;
	hands?: HandsMode | null;
	drill?: PracticeDrill | null;
	note?: string | null;
	source?: string | null;
	seamBefore?: "held" | "broken" | null;
}

export type LastLogScope =
	| { type: "piece"; pieceId: string }
	| { type: "section"; pieceId: string; sectionId: string }
	| { type: "technique"; techniqueId: string };

export function logModeKey(log: NormalizedLastLog): ModeKey {
	return modeKey(log.hands ?? "HT", log.drill ?? null);
}

export function normalizeLastLog(
	data: Record<string, unknown>,
	scopeType: LastLogScope["type"],
): NormalizedLastLog {
	const rawDate = data.date as { toDate?: () => Date } | string | null;
	const date =
		rawDate != null &&
		typeof (rawDate as { toDate?: unknown }).toDate === "function"
			? (rawDate as { toDate: () => Date }).toDate()
			: new Date(rawDate as string);

	if (scopeType === "piece") {
		return {
			date,
			technicalMistakes: (data.technicalMistakes as PracticeMistakes) ?? null,
			memoryMistakes: (data.memoryMistakes as PracticeMistakes) ?? null,
			achievedBpm: (data.achievedBpm as number) ?? null,
			note: (data.note as string) ?? null,
		};
	}
	return {
		date,
		quality: (data.quality as 1 | 2 | 3 | 4 | 5) ?? null,
		effort: (data.effort as 1 | 2 | 3 | 4 | 5) ?? null,
		achievedBpm: (data.achievedBpm as number) ?? null,
		hands: (data.hands as HandsMode) ?? null,
		drill: (data.drill as PracticeDrill) ?? null,
		note: (data.note as string) ?? null,
		source: (data.source as string) ?? null,
		seamBefore: (data.seamBefore as "held" | "broken") ?? null,
	};
}

export const PAGE_SIZE = 30;

export interface HistoryLog extends NormalizedLastLog {
	id: string;
	flaggedSectionIds: string[];
}

export interface HistoryMode extends HistoryLog {
	key: ModeKey;
	hands: HandsMode;
	drill: PracticeDrill | null;
}

export interface HistoryEntry {
	id: string;
	kind: "run-through" | "section" | "credited" | "technique";
	scope: LastLogScope;
	date: Date;
	note: string | null;
	flaggedSectionIds: string[];
	modes: HistoryMode[];
	drillGroups: { drill: PracticeDrill; modes: HistoryMode[] }[];
}

export interface HistoryStream {
	scope: LastLogScope;
	logs: HistoryLog[];
	hasMore: boolean;
}

export type HistoryFilter = "all" | "run-throughs" | `section:${string}`;

export function normalizeHistoryLog(
	doc: { id: string; data: Record<string, unknown> },
	scopeType: LastLogScope["type"],
): HistoryLog {
	return {
		...normalizeLastLog(doc.data, scopeType),
		id: doc.id,
		flaggedSectionIds: (doc.data.flaggedSectionIds as string[]) ?? [],
	};
}

export function groupHistoryLogs(
	scope: LastLogScope,
	logs: HistoryLog[],
): HistoryEntry[] {
	const groups = new Map<number, HistoryLog[]>();
	for (const log of logs) {
		const time = log.date.getTime();
		const group = groups.get(time) ?? [];
		group.push(log);
		groups.set(time, group);
	}
	return [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([time, group]) => {
			const first = group[0];
			const kind =
				scope.type === "piece"
					? "run-through"
					: scope.type === "technique"
						? "technique"
						: first.source === RUN_THROUGH_LOG_SOURCE
							? "credited"
							: "section";
			const modes: HistoryMode[] = group
				.map((log) => ({
					...log,
					key: logModeKey(log),
					hands: log.hands ?? "HT",
					drill: scope.type === "technique" ? (log.drill ?? null) : null,
				}))
				.sort(
					(a, b) => HANDS_MODES.indexOf(a.hands) - HANDS_MODES.indexOf(b.hands),
				);
			const drills = new Map<PracticeDrill, HistoryMode[]>();
			for (const mode of modes) {
				if (mode.drill) {
					const drillModes = drills.get(mode.drill) ?? [];
					drillModes.push(mode);
					drills.set(mode.drill, drillModes);
				}
			}
			const parent =
				scope.type === "technique"
					? [scope.type, scope.techniqueId]
					: [
							scope.type,
							scope.pieceId,
							...(scope.type === "section" ? [scope.sectionId] : []),
						];
			return {
				id: JSON.stringify([...parent, time]),
				kind,
				scope,
				date: first.date,
				note: group.find((log) => log.note != null)?.note ?? null,
				flaggedSectionIds: first.flaggedSectionIds,
				modes: modes.filter((mode) => mode.drill === null),
				drillGroups: [...drills].map(([drill, drillModes]) => ({
					drill,
					modes: drillModes,
				})),
			};
		});
}

export function mergeHistoryPage(input: HistoryStream[]): {
	entries: HistoryEntry[];
	streams: HistoryStream[];
	refill: number[];
	hasMore: boolean;
} {
	const streams = input.map((stream) => ({
		...stream,
		logs: [...stream.logs],
	}));
	const entries: HistoryEntry[] = [];
	let refill: number[] = [];
	while (entries.length < PAGE_SIZE) {
		refill = streams.flatMap((stream, index) => {
			const first = stream.logs[0];
			const oldest = stream.logs[stream.logs.length - 1];
			return stream.hasMore &&
				(!first || first.date.getTime() === oldest.date.getTime())
				? [index]
				: [];
		});
		if (refill.length) break;
		let newest = -1;
		for (let index = 0; index < streams.length; index++) {
			const first = streams[index].logs[0];
			if (
				first &&
				(newest === -1 ||
					first.date.getTime() > streams[newest].logs[0].date.getTime())
			)
				newest = index;
		}
		if (newest === -1) break;
		const stream = streams[newest];
		const time = stream.logs[0].date.getTime();
		let count = 1;
		while (
			count < stream.logs.length &&
			stream.logs[count].date.getTime() === time
		)
			count++;
		entries.push(
			groupHistoryLogs(stream.scope, stream.logs.splice(0, count))[0],
		);
	}
	return {
		entries,
		streams,
		refill,
		hasMore: streams.some((stream) => stream.hasMore || stream.logs.length > 0),
	};
}

export function filterHistoryEntries(
	entries: HistoryEntry[],
	filter: HistoryFilter,
): HistoryEntry[] {
	return entries.filter((entry) => {
		if (filter === "all") return entry.kind !== "credited";
		if (filter === "run-throughs") return entry.kind === "run-through";
		return (
			entry.scope.type === "section" &&
			entry.scope.sectionId === filter.slice("section:".length) &&
			(entry.kind === "section" || entry.kind === "credited")
		);
	});
}

export function scoreSteps(
	value: number | null | undefined,
	metric: "quality" | "effort" | "mistakes",
): 1 | 2 | 3 | 4 | 5 | null {
	if (value == null) return null;
	const steps = metric === "mistakes" ? 5 - value : value;
	return Number.isInteger(steps) && steps >= 1 && steps <= 5
		? (steps as 1 | 2 | 3 | 4 | 5)
		: null;
}

export { dayKey as historyDayKey };

export function formatHistoryDay(
	date: Date,
	t: TFunction,
	locale: string,
	now = new Date(),
): string {
	const key = dayKey(date);
	if (key === dayKey(now)) return t("common.today");
	const yesterday = dayStartCutoff(now);
	yesterday.setDate(yesterday.getDate() - 1);
	if (key === dayKey(yesterday)) return t("common.yesterday");
	const day = dayStartCutoff(date);
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		...(day.getFullYear() !== now.getFullYear()
			? { year: "numeric" as const }
			: {}),
	}).format(day);
}
