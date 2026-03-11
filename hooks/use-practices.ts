import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeMistakes } from "@/models/practice";
import { useUpdatePiece } from "./use-pieces";

export function useSavePractice() {
	const { user } = useAuth();
	const { updatePiece } = useUpdatePiece();

	const savePractice = async (
		pieceId: string,
		date: Date,
		technicalMistakes: PracticeMistakes,
		memoryMistakes: PracticeMistakes,
	) => {
		if (!user) throw new Error("Not authenticated");

		const practicesRef = collection(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"practices",
		);

		await addDoc(practicesRef, {
			date: Timestamp.fromDate(date),
			technicalMistakes,
			memoryMistakes,
		});

		// Denormalize last practice data onto the piece
		await updatePiece(pieceId, {
			lastPracticed: date,
			lastTechnicalMistakes: technicalMistakes,
			lastMemoryMistakes: memoryMistakes,
		});
	};

	return { savePractice };
}
