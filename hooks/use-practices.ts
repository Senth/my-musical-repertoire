import {
	addDoc,
	collection,
	doc,
	serverTimestamp,
	Timestamp,
	updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeMistakes, PracticeTrigger } from "@/models/practice";
import { useUpdatePiece } from "./use-pieces";

export function useSavePractice() {
	const { user } = useAuth();
	const { updatePiece } = useUpdatePiece();

	const savePractice = async (
		pieceId: string,
		date: Date,
		technicalMistakes: PracticeMistakes,
		memoryMistakes: PracticeMistakes,
		achievedBpm?: number | null,
		flaggedSectionIds?: string[] | null,
		triggeredFrom?: PracticeTrigger,
		sessionId?: string | null,
	) => {
		if (!user) throw new Error("Not authenticated");

		const practiceLogsRef = collection(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"practiceLogs",
		);

		await addDoc(practiceLogsRef, {
			date: Timestamp.fromDate(date),
			technicalMistakes,
			memoryMistakes,
			achievedBpm: achievedBpm ?? null,
			flaggedSectionIds: flaggedSectionIds ?? null,
			triggeredFrom: triggeredFrom ?? null,
			sessionId: sessionId ?? null,
		});

		await updatePiece(pieceId, {
			lastPracticed: date,
			lastTechnicalMistakes: technicalMistakes,
			lastMemoryMistakes: memoryMistakes,
			...(achievedBpm != null ? { lastAchievedTempoBpm: achievedBpm } : {}),
		});

		if (flaggedSectionIds && flaggedSectionIds.length > 0) {
			const sectionRef = (sId: string) =>
				doc(db, "users", user.uid, "pieces", pieceId, "sections", sId);
			await Promise.all(
				flaggedSectionIds.map((sId) =>
					updateDoc(sectionRef(sId), { lastPracticed: serverTimestamp() }),
				),
			);
		}
	};

	return { savePractice };
}

export function useSaveSectionPractice() {
	const { user } = useAuth();
	const { updatePiece } = useUpdatePiece();

	const saveSectionPractice = async (
		pieceId: string,
		sectionId: string,
		date: Date,
		quality: 1 | 2 | 3 | 4 | 5,
		effort: 1 | 2 | 3 | 4 | 5,
		achievedBpm?: number | null,
		triggeredFrom?: PracticeTrigger,
		sessionId?: string | null,
	) => {
		if (!user) throw new Error("Not authenticated");

		const practiceLogsRef = collection(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
			"practiceLogs",
		);

		await addDoc(practiceLogsRef, {
			date: Timestamp.fromDate(date),
			quality,
			effort,
			achievedBpm: achievedBpm ?? null,
			triggeredFrom: triggeredFrom ?? null,
			sessionId: sessionId ?? null,
		});

		const sectionRef = doc(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
		);
		await updateDoc(sectionRef, {
			lastPracticed: serverTimestamp(),
			lastQuality: quality,
			lastEffort: effort,
			...(achievedBpm != null ? { currentBpm: achievedBpm } : {}),
		});

		await updatePiece(pieceId, {
			lastPracticed: date,
			...(achievedBpm != null ? { lastAchievedTempoBpm: achievedBpm } : {}),
		});
	};

	return { saveSectionPractice };
}
