import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	getDocs,
	onSnapshot,
	query,
	type Timestamp,
	updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { LearningPhase, Piece, PieceState } from "@/models/piece";
import type { PracticeMistakes } from "@/models/practice";

interface FirestorePiece {
	title: string;
	composer: string;
	state?: PieceState;
	learningPhase?: LearningPhase | null;
	targetTempoBpm?: number | null;
	difficulty?: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed?: Timestamp | null;
	lastTechnicalMistakes?: PracticeMistakes;
	lastMemoryMistakes?: PracticeMistakes;
}

function fromFirestore(
	id: string,
	data: FirestorePiece,
	userId: string,
): Piece {
	return {
		id,
		userId,
		title: data.title,
		composer: data.composer,
		state: data.state ?? "maintenance",
		learningPhase: data.learningPhase ?? null,
		targetTempoBpm: data.targetTempoBpm ?? null,
		difficulty: data.difficulty ?? null,
		lastPracticed: data.lastPracticed?.toDate() ?? null,
		lastTechnicalMistakes: data.lastTechnicalMistakes,
		lastMemoryMistakes: data.lastMemoryMistakes,
	};
}

export function usePieces() {
	const { user } = useAuth();
	const [pieces, setPieces] = useState<Piece[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setPieces([]);
			setLoading(false);
			return;
		}

		const piecesRef = collection(db, "users", user.uid, "pieces");
		const q = query(piecesRef);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const result = snapshot.docs.map((doc) =>
				fromFirestore(doc.id, doc.data() as FirestorePiece, user.uid),
			);
			setPieces(result);
			setLoading(false);
		});

		return unsubscribe;
	}, [user]);

	return { pieces, loading };
}

export function useAddPiece() {
	const { user } = useAuth();

	const addPiece = async (
		title: string,
		composer: string,
		state: PieceState = "learning",
		targetTempoBpm: number | null = null,
	) => {
		if (!user) throw new Error("Not authenticated");

		const piecesRef = collection(db, "users", user.uid, "pieces");
		await addDoc(piecesRef, {
			title,
			composer,
			state,
			targetTempoBpm,
			lastPracticed: null,
		});
	};

	return { addPiece };
}

export function useUpdatePiece() {
	const { user } = useAuth();

	const updatePiece = async (
		pieceId: string,
		updates: Partial<
			Pick<
				Piece,
				| "title"
				| "composer"
				| "state"
				| "learningPhase"
				| "targetTempoBpm"
				| "difficulty"
				| "lastPracticed"
				| "lastTechnicalMistakes"
				| "lastMemoryMistakes"
			>
		>,
	) => {
		if (!user) throw new Error("Not authenticated");

		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		await updateDoc(pieceRef, updates);
	};

	return { updatePiece };
}

export function useDeletePiece() {
	const { user } = useAuth();

	const deletePiece = async (pieceId: string) => {
		if (!user) throw new Error("Not authenticated");

		const practicesRef = collection(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"practices",
		);
		const practicesSnapshot = await getDocs(practicesRef);
		await Promise.all(practicesSnapshot.docs.map((d) => deleteDoc(d.ref)));

		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		await deleteDoc(pieceRef);
	};

	return { deletePiece };
}
