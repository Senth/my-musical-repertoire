import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeMistakes } from "@/models/practice";

export interface NormalizedLastLog {
	date: Date;
	technicalMistakes?: PracticeMistakes | null;
	memoryMistakes?: PracticeMistakes | null;
	quality?: 1 | 2 | 3 | 4 | 5 | null;
	effort?: 1 | 2 | 3 | 4 | 5 | null;
	achievedBpm?: number | null;
}

type PieceScope = { type: "piece"; pieceId: string };
type SectionScope = { type: "section"; pieceId: string; sectionId: string };
type TechniqueScope = { type: "technique"; techniqueId: string };
export type LastLogScope = PieceScope | SectionScope | TechniqueScope;

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
	};
}

export function useLastPracticeLog(scope: LastLogScope): {
	lastLog: NormalizedLastLog | null;
	loading: boolean;
} {
	const { user } = useAuth();
	const [lastLog, setLastLog] = useState<NormalizedLastLog | null>(null);
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
			setLoading(false);
			return;
		}

		const q = query(ref, orderBy("date", "desc"), limit(1));

		getDocs(q)
			.then((snap) => {
				if (snap.empty) {
					setLastLog(null);
				} else {
					setLastLog(
						normalizeLastLog(
							snap.docs[0].data() as Record<string, unknown>,
							scopeType,
						),
					);
				}
				setLoading(false);
			})
			.catch(() => {
				setLastLog(null);
				setLoading(false);
			});
	}, [user, scopeType, pieceId, sectionId, techniqueId]);

	return { lastLog, loading };
}
