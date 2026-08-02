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
import type { Piece, PieceState } from "@/models/piece";
import type { PracticeMistakes } from "@/models/practice";

interface FirestorePiece {
	title: string;
	composer: string;
	collectionName?: string | null;
	state?: PieceState;
	targetTempoBpm?: number | null;
	difficulty?: 1 | 2 | 3 | 4 | 5 | null;
	lastPracticed?: Timestamp | null;
	lastTechnicalMistakes?: PracticeMistakes;
	lastMemoryMistakes?: PracticeMistakes;
	lastAchievedTempoBpm?: number | null;
	sectionCount?: number;
	notes?: string | null;
	durationSeconds?: number | null;
}

export function fromFirestore(
	id: string,
	data: FirestorePiece,
	userId: string,
): Piece {
	return {
		id,
		userId,
		title: data.title,
		composer: data.composer,
		collectionName: data.collectionName ?? null,
		state: data.state ?? "maintenance",
		targetTempoBpm: data.targetTempoBpm ?? null,
		difficulty: data.difficulty ?? null,
		lastPracticed: data.lastPracticed?.toDate() ?? null,
		lastTechnicalMistakes: data.lastTechnicalMistakes,
		lastMemoryMistakes: data.lastMemoryMistakes,
		lastAchievedTempoBpm: data.lastAchievedTempoBpm ?? null,
		sectionCount: data.sectionCount ?? 0,
		notes: data.notes ?? null,
		durationSeconds: data.durationSeconds ?? null,
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

	const addPiece = async ({
		title,
		composer,
		collectionName = null,
		state = "learning",
		targetTempoBpm = null,
		durationSeconds = null,
	}: {
		title: string;
		composer: string;
		collectionName?: string | null;
		state?: PieceState;
		targetTempoBpm?: number | null;
		durationSeconds?: number | null;
	}) => {
		if (!user) throw new Error("Not authenticated");

		const piecesRef = collection(db, "users", user.uid, "pieces");
		await addDoc(piecesRef, {
			title,
			composer,
			collectionName,
			state,
			targetTempoBpm,
			durationSeconds,
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
				| "collectionName"
				| "state"
				| "targetTempoBpm"
				| "difficulty"
				| "lastPracticed"
				| "lastTechnicalMistakes"
				| "lastMemoryMistakes"
				| "lastAchievedTempoBpm"
				| "notes"
				| "durationSeconds"
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
