import {
	addDoc,
	collection,
	type DocumentReference,
	doc,
	getDocs,
	onSnapshot,
	query,
	type Timestamp,
	updateDoc,
	writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Piece, PieceState } from "@/models/piece";
import type { PracticeMistakes } from "@/models/practice";
import { awaitWrite } from "@/utils/firestore-write";

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
	allSectionsAdded?: boolean;
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
		allSectionsAdded: data.allSectionsAdded ?? false,
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
		await awaitWrite(
			addDoc(piecesRef, {
				title,
				composer,
				collectionName,
				state,
				targetTempoBpm,
				durationSeconds,
				lastPracticed: null,
			}),
		);
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
				| "allSectionsAdded"
			>
		>,
	) => {
		if (!user) throw new Error("Not authenticated");

		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		await awaitWrite(updateDoc(pieceRef, updates));
	};

	return { updatePiece };
}

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const DELETE_BATCH_LIMIT = 450;

export function useDeletePiece() {
	const { user } = useAuth();

	/**
	 * Deletes the piece and everything under it. Firestore has no cascading
	 * delete, so the subcollections have to be enumerated by hand — left behind
	 * they are unreachable orphans that still occupy storage.
	 *
	 * Children are deleted before the piece itself, so a failure part-way leaves
	 * the piece still listed rather than a ghost tree under a piece that is gone.
	 */
	const deletePiece = async (pieceId: string) => {
		if (!user) throw new Error("Not authenticated");

		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		const targets: DocumentReference[] = [];

		const sectionsSnapshot = await getDocs(collection(pieceRef, "sections"));
		for (const section of sectionsSnapshot.docs) {
			const logs = await getDocs(collection(section.ref, "practiceLogs"));
			targets.push(...logs.docs.map((d) => d.ref));
			targets.push(section.ref);
		}

		const pieceLogs = await getDocs(collection(pieceRef, "practiceLogs"));
		targets.push(...pieceLogs.docs.map((d) => d.ref));
		targets.push(pieceRef);

		for (let i = 0; i < targets.length; i += DELETE_BATCH_LIMIT) {
			const batch = writeBatch(db);
			for (const ref of targets.slice(i, i + DELETE_BATCH_LIMIT)) {
				batch.delete(ref);
			}
			await awaitWrite(batch.commit());
		}
	};

	return { deletePiece };
}
