import {
	collection,
	doc,
	getDocs,
	increment,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Section, SectionPhase } from "@/models/section";

interface FirestoreSection {
	label: string;
	order: number;
	phase: SectionPhase;
	startBar?: number | null;
	endBar?: number | null;
	currentBpm?: number | null;
	targetBpmOverride?: number | null;
	notes?: string | null;
	archived: boolean;
	createdAt?: { toDate: () => Date } | null;
}

function fromFirestore(
	id: string,
	data: FirestoreSection,
	pieceId: string,
	userId: string,
): Section {
	return {
		id,
		pieceId,
		userId,
		label: data.label,
		order: data.order,
		phase: data.phase,
		startBar: data.startBar ?? null,
		endBar: data.endBar ?? null,
		currentBpm: data.currentBpm ?? null,
		targetBpmOverride: data.targetBpmOverride ?? null,
		notes: data.notes ?? null,
		archived: data.archived ?? false,
		createdAt: data.createdAt?.toDate() ?? null,
	};
}

function sectionsRef(userId: string, pieceId: string) {
	return collection(db, "users", userId, "pieces", pieceId, "sections");
}

export function useSections(pieceId: string) {
	const { user } = useAuth();
	const [sections, setSections] = useState<Section[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user || !pieceId) {
			setSections([]);
			setLoading(false);
			return;
		}

		const q = query(
			sectionsRef(user.uid, pieceId),
			where("archived", "==", false),
			orderBy("order", "asc"),
		);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const result = snapshot.docs.map((d) =>
				fromFirestore(d.id, d.data() as FirestoreSection, pieceId, user.uid),
			);
			setSections(result);
			setLoading(false);
		});

		return unsubscribe;
	}, [user, pieceId]);

	return { sections, loading };
}

export function useAddSection() {
	const { user } = useAuth();

	const addSection = async (
		pieceId: string,
		data: Omit<Section, "id" | "pieceId" | "userId" | "archived" | "createdAt">,
	) => {
		if (!user) throw new Error("Not authenticated");

		const batch = writeBatch(db);

		const sRef = sectionsRef(user.uid, pieceId);
		const newSectionRef = doc(sRef);
		batch.set(newSectionRef, {
			...data,
			archived: false,
			createdAt: serverTimestamp(),
		});

		// Increment sectionCount on the piece
		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		batch.update(pieceRef, { sectionCount: increment(1) });

		await batch.commit();
	};

	return { addSection };
}

export function useUpdateSection() {
	const { user } = useAuth();

	const updateSection = async (
		pieceId: string,
		sectionId: string,
		updates: Partial<
			Pick<
				Section,
				| "label"
				| "order"
				| "phase"
				| "startBar"
				| "endBar"
				| "currentBpm"
				| "targetBpmOverride"
				| "notes"
			>
		>,
	) => {
		if (!user) throw new Error("Not authenticated");

		const sectionRef = doc(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
		);
		await updateDoc(sectionRef, updates);
	};

	return { updateSection };
}

export function useArchiveSection() {
	const { user } = useAuth();

	const archiveSection = async (pieceId: string, sectionId: string) => {
		if (!user) throw new Error("Not authenticated");

		const batch = writeBatch(db);

		const sectionRef = doc(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
		);
		batch.update(sectionRef, { archived: true });

		// Decrement sectionCount on the piece (minimum 0)
		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		batch.update(pieceRef, { sectionCount: increment(-1) });

		await batch.commit();
	};

	return { archiveSection };
}

export function useReorderSections() {
	const { user } = useAuth();

	const reorderSections = async (
		pieceId: string,
		orderedSectionIds: string[],
	) => {
		if (!user) throw new Error("Not authenticated");

		const batch = writeBatch(db);
		for (let i = 0; i < orderedSectionIds.length; i++) {
			const sectionRef = doc(
				db,
				"users",
				user.uid,
				"pieces",
				pieceId,
				"sections",
				orderedSectionIds[i],
			);
			batch.update(sectionRef, { order: i });
		}
		await batch.commit();
	};

	return { reorderSections };
}

export async function getSectionCount(
	userId: string,
	pieceId: string,
): Promise<number> {
	const q = query(sectionsRef(userId, pieceId), where("archived", "==", false));
	const snapshot = await getDocs(q);
	return snapshot.size;
}
