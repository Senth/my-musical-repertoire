import { useFocusEffect } from "expo-router";
import {
	collection,
	getDocs,
	getDocsFromCache,
	limit,
	orderBy,
	query,
	Timestamp,
	where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { HandsMode } from "@/models/practice";
import { normalizeHistoryLog } from "@/utils/practice-history";
import {
	buildSeries,
	type ChartRange,
	rangeStart,
} from "@/utils/progress-chart";
import { type ProgressRow, progressRowId } from "@/utils/repertoire-progress";

type Baseline = Partial<Record<HandsMode, number>>;

export function useProgressMoved(
	rows: readonly ProgressRow[],
	range: ChartRange,
) {
	const { user } = useAuth();
	const uid = user?.uid;
	const rowIds = JSON.stringify(rows.map(progressRowId).sort());
	const cache = useRef(new Map<string, Baseline>());
	const reads = useRef(Promise.resolve());
	const [focused, setFocused] = useState(false);
	const [visit, setVisit] = useState(0);
	const key = JSON.stringify([uid, range, visit]);
	const [state, setState] = useState({
		key,
		baselines: {} as Record<string, Baseline>,
		error: null as Error | null,
	});

	useFocusEffect(
		useCallback(() => {
			cache.current = new Map();
			setVisit((value) => value + 1);
			setFocused(!!uid);
			return () => setFocused(false);
		}, [uid]),
	);

	useEffect(() => {
		if (!uid || !focused) return;
		let active = true;
		const ids = JSON.parse(rowIds) as string[];
		const values = cache.current;
		const start = rangeStart(range, new Date());
		let next = 0;
		let error: Error | null = null;
		const baselines: Record<string, Baseline> = {};
		const publish = () => {
			if (active)
				setState({
					key,
					baselines: { ...baselines },
					error,
				});
		};
		const worker = async () => {
			while (active && next < ids.length) {
				const id = ids[next++];
				const cacheKey = JSON.stringify([range, id]);
				if (values.has(cacheKey)) continue;
				const kind = id.startsWith("pieces/") ? "section" : "technique";
				const q = query(
					collection(db, "users", uid, ...id.split("/"), "practiceLogs"),
					...(start ? [where("date", ">=", Timestamp.fromDate(start))] : []),
					orderBy("date", "asc"),
					limit(50),
				);
				const save = (
					snapshot: Awaited<ReturnType<typeof getDocs>>,
					remember: boolean,
				) => {
					const series = buildSeries(
						snapshot.docs.map((doc) =>
							normalizeHistoryLog(
								{ id: doc.id, data: doc.data() as Record<string, unknown> },
								kind,
							),
						),
						kind,
					);
					baselines[id] = Object.fromEntries(
						series.map(({ hands, points }) => [hands, points[0].bpm]),
					);
					if (remember) values.set(cacheKey, baselines[id]);
					publish();
				};
				try {
					await getDocsFromCache(q).then(
						(snapshot) => save(snapshot, false),
						() => {},
					);
					save(await getDocs(q), true);
				} catch (failure) {
					if ((failure as { code?: string })?.code === "unavailable") {
						if (baselines[id]) values.set(cacheKey, baselines[id]);
					} else
						error =
							failure instanceof Error ? failure : new Error(String(failure));
					publish();
				}
			}
		};
		const previous = reads.current;
		reads.current = (async () => {
			await previous;
			if (!active) return;
			for (const id of ids) {
				const baseline = values.get(JSON.stringify([range, id]));
				if (baseline) baselines[id] = baseline;
			}
			publish();
			await Promise.all(
				Array.from({ length: Math.min(8, ids.length) }, worker),
			);
		})();
		return () => {
			active = false;
		};
	}, [uid, focused, key, rowIds, range]);

	return state.key === key && uid
		? { baselines: state.baselines, error: state.error }
		: { baselines: {}, error: null };
}
