import { useFocusEffect } from "expo-router";
import {
	collection,
	getDocs,
	limit,
	orderBy,
	query,
	Timestamp,
	where,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSightReadingLog } from "@/models/sight-reading";
import { normalizeHistoryLog } from "@/utils/practice-history";
import {
	buildSeries,
	CHART_LOG_CAP,
	type ChartRange,
	type ChartSeries,
	rangeStart,
} from "@/utils/progress-chart";

export type ProgressScope =
	| { type: "section"; pieceId: string; sectionId: string }
	| { type: "run-throughs"; pieceId: string }
	| { type: "technique"; techniqueId: string }
	| { type: "sight-reading" };

export function useProgressSeries(
	scope: ProgressScope,
	range: ChartRange = "3m",
) {
	const { user } = useAuth();
	const uid = user?.uid;
	const type = scope.type;
	const pieceId = "pieceId" in scope ? scope.pieceId : "";
	const sectionId = type === "section" ? scope.sectionId : "";
	const techniqueId = type === "technique" ? scope.techniqueId : "";
	const ready =
		!!uid &&
		(type === "sight-reading" || !!(pieceId || techniqueId)) &&
		(type !== "section" || !!sectionId);
	const key = JSON.stringify([
		uid,
		type,
		pieceId,
		sectionId,
		techniqueId,
		range,
	]);
	const [state, setState] = useState({
		key,
		series: [] as ChartSeries[],
		loading: ready,
		error: null as Error | null,
	});

	useFocusEffect(
		useCallback(() => {
			let active = true;
			setState({ key, series: [], loading: ready, error: null });
			if (uid && ready) {
				const read = async () => {
					try {
						const path =
							type === "sight-reading"
								? ["sightReadingLogs"]
								: [
										...(type === "technique"
											? ["techniques", techniqueId]
											: [
													"pieces",
													pieceId,
													...(type === "section"
														? ["sections", sectionId]
														: []),
												]),
										"practiceLogs",
									];
						const start = rangeStart(range, new Date());
						const snapshot = await getDocs(
							query(
								collection(db, "users", uid, ...path),
								...(start
									? [where("date", ">=", Timestamp.fromDate(start))]
									: []),
								orderBy("date", "desc"),
								limit(CHART_LOG_CAP),
							),
						);
						const logs = snapshot.docs.map((doc) =>
							type === "sight-reading"
								? normalizeSightReadingLog(doc.data())
								: normalizeHistoryLog(
										{ id: doc.id, data: doc.data() },
										type === "run-throughs" ? "piece" : type,
									),
						);
						if (active)
							setState({
								key,
								series: buildSeries(
									logs,
									type === "run-throughs" ? "run-through" : type,
								),
								loading: false,
								error: null,
							});
					} catch (error) {
						if (active)
							setState({
								key,
								series: [],
								loading: false,
								error:
									(error as { code?: string })?.code === "unavailable"
										? null
										: error instanceof Error
											? error
											: new Error(String(error)),
							});
					}
				};
				void read();
			}
			return () => {
				active = false;
			};
		}, [key, uid, ready, type, pieceId, sectionId, techniqueId, range]),
	);

	const visible =
		state.key === key ? state : { series: [], loading: ready, error: null };
	return {
		series: visible.series,
		loading: visible.loading,
		error: visible.error,
	};
}
