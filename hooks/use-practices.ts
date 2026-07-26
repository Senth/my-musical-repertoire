import {
	addDoc,
	collection,
	doc,
	getDoc,
	serverTimestamp,
	Timestamp,
	updateDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeMistakes, PracticeTrigger } from "@/models/practice";
import {
	byModeFromFirestore,
	deriveFromByMode,
	type ModeEntry,
	mergeByMode,
} from "@/utils/practice-modes";
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

	/** Writes one practice log per mode, then folds them all into `byMode`. */
	const saveSectionPractice = async (
		pieceId: string,
		sectionId: string,
		date: Date,
		entries: ModeEntry[],
		triggeredFrom?: PracticeTrigger,
		sessionId?: string | null,
	) => {
		if (!user) throw new Error("Not authenticated");
		if (entries.length === 0) return;

		const sectionRef = doc(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
		);
		const practiceLogsRef = collection(sectionRef, "practiceLogs");

		await Promise.all(
			entries.map((entry) =>
				addDoc(practiceLogsRef, {
					date: Timestamp.fromDate(date),
					quality: entry.quality,
					effort: entry.effort,
					achievedBpm: entry.bpm ?? null,
					hands: entry.hands,
					drill: entry.drill ?? null,
					triggeredFrom: triggeredFrom ?? null,
					sessionId: sessionId ?? null,
				}),
			),
		);

		const snap = await getDoc(sectionRef);
		const byMode = mergeByMode(
			byModeFromFirestore(snap.data()?.byMode),
			entries,
			date,
		);
		const derived = deriveFromByMode(byMode);

		await updateDoc(sectionRef, {
			byMode,
			lastPracticed: derived.lastPracticed ?? date,
			lastQuality: derived.quality,
			lastEffort: derived.effort,
			...(derived.bpm != null ? { currentBpm: derived.bpm } : {}),
		});

		await updatePiece(pieceId, {
			lastPracticed: date,
			...(derived.bpm != null ? { lastAchievedTempoBpm: derived.bpm } : {}),
		});
	};

	return { saveSectionPractice };
}
