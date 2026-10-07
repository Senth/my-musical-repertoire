import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { ModeKey } from "@/models/practice";
import {
	type LastLogScope,
	logModeKey,
	type NormalizedLastLog,
	normalizeLastLog,
} from "@/utils/practice-history";

export {
	type LastLogScope,
	logModeKey,
	type NormalizedLastLog,
	normalizeLastLog,
} from "@/utils/practice-history";

/**
 * How many logs to pull for mode-aware scopes. Filtering client-side keeps the
 * per-mode lookup on the existing `date` index — no composite index needed.
 */
const MODE_LOG_LIMIT = 25;

/** Bucket logs (newest first) by mode key, keeping the newest per mode. */
export function groupLogsByMode(
	logs: NormalizedLastLog[],
): Record<ModeKey, NormalizedLastLog> {
	const out: Record<ModeKey, NormalizedLastLog> = {};
	for (const log of logs) {
		const key = logModeKey(log);
		if (!out[key]) out[key] = log;
	}
	return out;
}

export function useLastPracticeLog(
	scope: LastLogScope,
	count = MODE_LOG_LIMIT,
): {
	lastLog: NormalizedLastLog | null;
	logsByMode: Record<ModeKey, NormalizedLastLog>;
	/** The whole fetched window, newest first — what the multi-session criteria read. */
	logs: NormalizedLastLog[];
	loading: boolean;
} {
	const { user } = useAuth();
	const [lastLog, setLastLog] = useState<NormalizedLastLog | null>(null);
	const [logs, setLogs] = useState<NormalizedLastLog[]>([]);
	const [logsByMode, setLogsByMode] = useState<
		Record<ModeKey, NormalizedLastLog>
	>({});
	const [loading, setLoading] = useState(true);

	// Extract primitives so the effect deps are stable strings, not the scope object
	const scopeType = scope.type;
	const pieceId = scope.type !== "technique" ? scope.pieceId : undefined;
	const sectionId = scope.type === "section" ? scope.sectionId : undefined;
	const techniqueId =
		scope.type === "technique" ? scope.techniqueId : undefined;

	useEffect(() => {
		if (!user) {
			setLastLog(null);
			setLogs([]);
			setLogsByMode({});
			setLoading(false);
			return;
		}

		setLoading(true);

		let ref: ReturnType<typeof collection>;
		if (scopeType === "piece" && pieceId) {
			ref = collection(
				db,
				"users",
				user.uid,
				"pieces",
				pieceId,
				"practiceLogs",
			);
		} else if (scopeType === "section" && pieceId && sectionId) {
			ref = collection(
				db,
				"users",
				user.uid,
				"pieces",
				pieceId,
				"sections",
				sectionId,
				"practiceLogs",
			);
		} else if (scopeType === "technique" && techniqueId) {
			ref = collection(
				db,
				"users",
				user.uid,
				"techniques",
				techniqueId,
				"practiceLogs",
			);
		} else {
			setLastLog(null);
			setLogs([]);
			setLogsByMode({});
			setLoading(false);
			return;
		}

		const q = query(
			ref,
			orderBy("date", "desc"),
			limit(scopeType === "piece" ? 1 : count),
		);

		getDocs(q)
			.then((snap) => {
				const fetched = snap.docs.map((d) =>
					normalizeLastLog(d.data() as Record<string, unknown>, scopeType),
				);
				setLastLog(fetched[0] ?? null);
				setLogs(fetched);
				setLogsByMode(scopeType === "piece" ? {} : groupLogsByMode(fetched));
				setLoading(false);
			})
			.catch(() => {
				setLastLog(null);
				setLogs([]);
				setLogsByMode({});
				setLoading(false);
			});
	}, [user, scopeType, pieceId, sectionId, techniqueId, count]);

	return { lastLog, logsByMode, logs, loading };
}

export function useTechniqueLogs(
	techniqueIds: string[],
	count: number,
): Record<string, NormalizedLastLog[]> {
	const { user } = useAuth();
	const [logsById, setLogsById] = useState<Record<string, NormalizedLastLog[]>>(
		{},
	);
	const key = techniqueIds.join(",");

	useEffect(() => {
		if (!user || !key) {
			setLogsById({});
			return;
		}
		let cancelled = false;
		Promise.all(
			key.split(",").map(async (id) => {
				const ref = collection(
					db,
					"users",
					user.uid,
					"techniques",
					id,
					"practiceLogs",
				);
				const snap = await getDocs(
					query(ref, orderBy("date", "desc"), limit(count)),
				);
				const logs = snap.docs.map((d) =>
					normalizeLastLog(d.data() as Record<string, unknown>, "technique"),
				);
				return [id, logs] as const;
			}),
		)
			.then((entries) => {
				if (!cancelled) setLogsById(Object.fromEntries(entries));
			})
			.catch(() => {
				if (!cancelled) setLogsById({});
			});
		return () => {
			cancelled = true;
		};
	}, [user, key, count]);

	return logsById;
}
