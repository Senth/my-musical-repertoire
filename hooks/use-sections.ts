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
import { useEffect, useMemo, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { usePieces } from "@/hooks/use-pieces";
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
	lastPracticed?: { toDate: () => Date } | null;
	lastQuality?: 1 | 2 | 3 | 4 | 5 | null;
	lastEffort?: 1 | 2 | 3 | 4 | 5 | null;
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
		lastPracticed: data.lastPracticed?.toDate() ?? null,
		lastQuality: data.lastQuality ?? null,
		lastEffort: data.lastEffort ?? null,
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
		data: Omit<
			Section,
			"id" | "pieceId" | "userId" | "archived" | "createdAt" | "order"
		>,
	) => {
		if (!user) throw new Error("Not authenticated");

		const batch = writeBatch(db);
		const sRef = sectionsRef(user.uid, pieceId);

		// Fetch existing non-archived sections to compute insertion order
		const existingSnap = await getDocs(
			query(sRef, where("archived", "==", false), orderBy("order", "asc")),
		);
		type StoredSection = FirestoreSection & { id: string };
		const existing: StoredSection[] = existingSnap.docs.map((d) => ({
			id: d.id,
			...(d.data() as FirestoreSection),
		}));

		let newOrder: number;

		if (data.startBar != null) {
			// Split by whether they have a bar number
			const withBar = existing
				.filter((s) => s.startBar != null)
				.sort((a, b) => (a.startBar ?? 0) - (b.startBar ?? 0));
			const withoutBar = existing.filter((s) => s.startBar == null);

			// Find insertion point among bar-numbered sections
			const insertIdx = withBar.findIndex(
				(s) => (s.startBar ?? 0) > (data.startBar ?? 0),
			);
			const insertAt = insertIdx === -1 ? withBar.length : insertIdx;
			newOrder = insertAt;

			// Rebuild order: [withBar[0..insertAt-1], NEW, withBar[insertAt..], withoutBar]
			const reordered = [
				...withBar.slice(0, insertAt),
				null, // placeholder for new section
				...withBar.slice(insertAt),
				...withoutBar,
			];

			for (let i = 0; i < reordered.length; i++) {
				const s = reordered[i];
				if (s === null) continue; // new section handled below
				if (s.order !== i) {
					batch.update(doc(sRef, s.id), { order: i });
				}
			}
		} else {
			// Append after all bar-numbered sections (which come first), then no-bar sections
			newOrder = existing.length;
		}

		// Create the new section
		const newSectionRef = doc(sRef);
		batch.set(newSectionRef, {
			...data,
			order: newOrder,
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
				| "lastPracticed"
				| "lastQuality"
				| "lastEffort"
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

export function useAllSections() {
	const { user } = useAuth();
	const { pieces } = usePieces();
	const [sectionsByPiece, setSectionsByPiece] = useState<
		Record<string, Section[]>
	>({});
	const [loading, setLoading] = useState(true);

	const pieceIds = pieces
		.map((p) => p.id)
		.filter((id): id is string => !!id)
		.sort()
		.join(",");

	useEffect(() => {
		if (!user) {
			setSectionsByPiece({});
			setLoading(false);
			return;
		}
		const ids = pieceIds ? pieceIds.split(",") : [];
		if (ids.length === 0) {
			setSectionsByPiece({});
			setLoading(false);
			return;
		}
		const unsubs: Array<() => void> = [];
		const seen = new Set<string>();
		for (const pid of ids) {
			const q = query(
				sectionsRef(user.uid, pid),
				where("archived", "==", false),
				orderBy("order", "asc"),
			);
			const unsub = onSnapshot(q, (snap) => {
				const arr = snap.docs.map((d) =>
					fromFirestore(d.id, d.data() as FirestoreSection, pid, user.uid),
				);
				setSectionsByPiece((prev) => ({ ...prev, [pid]: arr }));
				seen.add(pid);
				if (seen.size === ids.length) {
					setLoading(false);
				}
			});
			unsubs.push(unsub);
		}
		return () => {
			for (const u of unsubs) u();
		};
	}, [user, pieceIds]);

	const sections = useMemo(
		() => Object.values(sectionsByPiece).flat(),
		[sectionsByPiece],
	);
	return { sections, loading };
}

export async function getSectionCount(
	userId: string,
	pieceId: string,
): Promise<number> {
	const q = query(sectionsRef(userId, pieceId), where("archived", "==", false));
	const snapshot = await getDocs(q);
	return snapshot.size;
}
