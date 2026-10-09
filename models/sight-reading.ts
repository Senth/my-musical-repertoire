export interface SightReadingLog {
	id?: string;
	date: Date;
	elapsedSeconds: number;
	achievedBpm: number | null;
	keptGoing: 1 | 2 | 3 | 4 | 5 | null;
}

export function normalizeSightReadingLog(
	data: Record<string, unknown>,
): SightReadingLog {
	const rawDate = data.date as { toDate?: () => Date } | string | null;
	const date =
		rawDate != null &&
		typeof (rawDate as { toDate?: unknown }).toDate === "function"
			? (rawDate as { toDate: () => Date }).toDate()
			: new Date(rawDate as string);
	return {
		date,
		elapsedSeconds: (data.elapsedSeconds as number) ?? 0,
		achievedBpm: (data.achievedBpm as number) ?? null,
		keptGoing: (data.keptGoing as SightReadingLog["keptGoing"]) ?? null,
	};
}
