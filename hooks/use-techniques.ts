import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	type Timestamp,
	updateDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type {
	TechniqueItem,
	TechniqueState,
	TechniqueType,
} from "@/models/technique";

interface FirestoreTechnique {
	title: string;
	state: TechniqueState;
	type?: TechniqueType | null;
	targetTempoBpm?: number | null;
	notes?: string | null;
	dateIntroduced: Timestamp;
	lastPracticedAt?: Timestamp | null;
	lastQuality?: 1 | 2 | 3 | 4 | 5 | null;
	lastEffort?: 1 | 2 | 3 | 4 | 5 | null;
	lastAchievedTempoBpm?: number | null;
}

function fromFirestore(
	id: string,
	data: FirestoreTechnique,
	userId: string,
): TechniqueItem {
	return {
		id,
		userId,
		title: data.title,
		state: data.state ?? "active",
		type: data.type ?? null,
		targetTempoBpm: data.targetTempoBpm ?? null,
		notes: data.notes ?? null,
		dateIntroduced: data.dateIntroduced.toDate(),
		lastPracticedAt: data.lastPracticedAt?.toDate() ?? null,
		lastQuality: data.lastQuality ?? null,
		lastEffort: data.lastEffort ?? null,
		lastAchievedTempoBpm: data.lastAchievedTempoBpm ?? null,
	};
}

const STATE_ORDER: Record<TechniqueState, number> = {
	active: 0,
	maintenance: 1,
	retired: 2,
};

function sortTechniques(items: TechniqueItem[]): TechniqueItem[] {
	return [...items].sort((a, b) => {
		const stateDiff = STATE_ORDER[a.state] - STATE_ORDER[b.state];
		if (stateDiff !== 0) return stateDiff;

		// Within same state: least recently practiced floats to top
		if (!a.lastPracticedAt && !b.lastPracticedAt) return 0;
		if (!a.lastPracticedAt) return -1;
		if (!b.lastPracticedAt) return 1;
		return a.lastPracticedAt.getTime() - b.lastPracticedAt.getTime();
	});
}

export function useTechniques() {
	const { user } = useAuth();
	const [techniques, setTechniques] = useState<TechniqueItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setTechniques([]);
			setLoading(false);
			return;
		}

		const ref = collection(db, "users", user.uid, "techniques");
		const q = query(ref);

		const unsubscribe = onSnapshot(q, (snapshot) => {
			const result = snapshot.docs.map((d) =>
				fromFirestore(d.id, d.data() as FirestoreTechnique, user.uid),
			);
			setTechniques(sortTechniques(result));
			setLoading(false);
		});

		return unsubscribe;
	}, [user]);

	return { techniques, loading };
}

export function useAddTechnique() {
	const { user } = useAuth();

	const addTechnique = async (
		title: string,
		options: {
			type?: TechniqueType | null;
			targetTempoBpm?: number | null;
			notes?: string | null;
			state?: TechniqueState;
		} = {},
	) => {
		if (!user) throw new Error("Not authenticated");

		const ref = collection(db, "users", user.uid, "techniques");
		await addDoc(ref, {
			title,
			state: options.state ?? "active",
			type: options.type ?? null,
			targetTempoBpm: options.targetTempoBpm ?? null,
			notes: options.notes ?? null,
			dateIntroduced: new Date(),
			lastPracticedAt: null,
		});
	};

	return { addTechnique };
}

export function useUpdateTechnique() {
	const { user } = useAuth();

	const updateTechnique = async (
		techniqueId: string,
		updates: Partial<
			Pick<
				TechniqueItem,
				| "title"
				| "state"
				| "type"
				| "targetTempoBpm"
				| "notes"
				| "lastPracticedAt"
				| "lastQuality"
				| "lastEffort"
				| "lastAchievedTempoBpm"
			>
		>,
	) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		await updateDoc(ref, updates);
	};

	return { updateTechnique };
}

export function useDeleteTechnique() {
	const { user } = useAuth();

	const deleteTechnique = async (techniqueId: string) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		await deleteDoc(ref);
	};

	return { deleteTechnique };
}

export function useSaveTechniqueLog() {
	const { user } = useAuth();

	const saveTechniqueLog = async (
		techniqueId: string,
		data: {
			quality: 1 | 2 | 3 | 4 | 5;
			effort: 1 | 2 | 3 | 4 | 5;
			achievedTempoBpm?: number | null;
		},
	) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		await updateDoc(ref, {
			lastPracticedAt: new Date(),
			lastQuality: data.quality,
			lastEffort: data.effort,
			lastAchievedTempoBpm: data.achievedTempoBpm ?? null,
		});
	};

	return { saveTechniqueLog };
}
