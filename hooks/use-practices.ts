import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeMistakes } from "@/models/practice";
import { useUpdatePiece } from "./use-pieces";
import { useUpdateSection } from "./use-sections";

export function useSavePractice() {
	const { user } = useAuth();
	const { updatePiece } = useUpdatePiece();
	const { updateSection } = useUpdateSection();

	const savePractice = async (
		pieceId: string,
		date: Date,
		technicalMistakes: PracticeMistakes,
		memoryMistakes: PracticeMistakes,
		achievedBpm?: number | null,
		sectionId?: string | null,
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
			achievedBpm: achievedBpm ?? null,
			sectionId: sectionId ?? null,
		});

		// Denormalize last practice data onto the piece
		await updatePiece(pieceId, {
			lastPracticed: date,
			lastTechnicalMistakes: technicalMistakes,
			lastMemoryMistakes: memoryMistakes,
		});

		// Update section's currentBpm when both sectionId and achievedBpm are set
		if (sectionId && achievedBpm != null) {
			await updateSection(pieceId, sectionId, { currentBpm: achievedBpm });
		}
	};

	return { savePractice };
}
