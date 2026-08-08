import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type {
	HandsMode,
	ModeKey,
	PracticeDrill,
	PracticeMistakes,
} from "@/models/practice";
import { modeKey } from "@/utils/practice-modes";

export interface NormalizedLastLog {
	date: Date;
	technicalMistakes?: PracticeMistakes | null;
	memoryMistakes?: PracticeMistakes | null;
	quality?: 1 | 2 | 3 | 4 | 5 | null;
	effort?: 1 | 2 | 3 | 4 | 5 | null;
	achievedBpm?: number | null;
	hands?: HandsMode | null;
	drill?: PracticeDrill | null;
}

type PieceScope = { type: "piece"; pieceId: string };
type SectionScope = { type: "section"; pieceId: string; sectionId: string };
type TechniqueScope = { type: "technique"; techniqueId: string };
export type LastLogScope = PieceScope | SectionScope | TechniqueScope;

/**
 * How many logs to pull for mode-aware scopes. Filtering client-side keeps the
 * per-mode lookup on the existing `date` index — no composite index needed.
 */
const MODE_LOG_LIMIT = 25;

/** Logs written before the hands axis existed are hands-together by convention. */
export function logModeKey(log: NormalizedLastLog): ModeKey {
	return modeKey(log.hands ?? "HT", log.drill ?? null);
}

export function normalizeLastLog(
	data: Record<string, unknown>,
	scopeType: "piece" | "section" | "technique",
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
		};
	}
	return {
		date,
		quality: (data.quality as 1 | 2 | 3 | 4 | 5) ?? null,
		effort: (data.effort as 1 | 2 | 3 | 4 | 5) ?? null,
		achievedBpm: (data.achievedBpm as number) ?? null,
		hands: (data.hands as HandsMode) ?? null,
		drill: (data.drill as PracticeDrill) ?? null,
	};
}

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

export function useLastPracticeLog(scope: LastLogScope): {
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

		const count = scopeType === "piece" ? 1 : MODE_LOG_LIMIT;
		const q = query(ref, orderBy("date", "desc"), limit(count));

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
	}, [user, scopeType, pieceId, sectionId, techniqueId]);

	return { lastLog, logsByMode, logs, loading };
}
