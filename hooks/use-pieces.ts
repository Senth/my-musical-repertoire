import {
	addDoc,
	collection,
	doc,
	onSnapshot,
	query,
	type Timestamp,
	updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Piece } from "@/models/piece";
import type { PracticeMistakes } from "@/models/practice";

interface FirestorePiece {
	title: string;
	composer: string;
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

	const addPiece = async (title: string, composer: string) => {
		if (!user) throw new Error("Not authenticated");

		const piecesRef = collection(db, "users", user.uid, "pieces");
		await addDoc(piecesRef, {
			title,
			composer,
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
