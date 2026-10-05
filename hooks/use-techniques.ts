import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	documentId,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	type QueryConstraint,
	type QuerySnapshot,
	query,
	startAfter,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { PracticeDrill, TechniqueHandsMode } from "@/models/practice";
import type {
	TechniqueItem,
	TechniqueState,
	TechniqueType,
} from "@/models/technique";
import { awaitWrite } from "@/utils/firestore-write";
import {
	byModeFromFirestore,
	deriveFromByMode,
	type ModeEntry,
	mergeByMode,
} from "@/utils/practice-modes";
import { timeSignatureFromFirestore } from "@/utils/time-signature";

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
	byMode?: unknown;
	handsMode?: TechniqueHandsMode | null;
	activeDrills?: PracticeDrill[] | null;
	timeSignature?: unknown;
	nudgeSnoozedUntil?: Timestamp | null;
}

export function fromFirestore(
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
		byMode: byModeFromFirestore(data.byMode),
		handsMode: data.handsMode ?? "separate",
		activeDrills: data.activeDrills ?? [],
		timeSignature: timeSignatureFromFirestore(data.timeSignature),
		nudgeSnoozedUntil: data.nudgeSnoozedUntil?.toDate() ?? null,
	};
}

const STATE_ORDER: Record<TechniqueState, number> = {
	active: 0,
	maintenance: 1,
	not_started: 2,
	retired: 3,
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

/** Not started techniques per queue read: the first live page, and each "Show more". */
export const QUEUE_PAGE = 20;

const queuePage = (uid: string, ...after: QueryConstraint[]) =>
	query(
		collection(db, "users", uid, "techniques"),
		where("state", "==", "not_started"),
		orderBy("dateIntroduced"),
		orderBy("title"),
		...after,
		limit(QUEUE_PAGE),
	);

/**
 * The listed techniques plus the Not started queue, oldest first, one page at a
 * time: what the session summary's curriculum card reads. Empty until both the
 * listed techniques and the first queue page have arrived, and nothing is
 * subscribed while `ids` is empty.
 */
export function useCurriculumTechniques(ids: string[]): {
	techniques: TechniqueItem[];
	showMore?: () => Promise<void>;
} {
	const { user } = useAuth();
	const [own, setOwn] = useState<TechniqueItem[] | null>(null);
	const [pages, setPages] = useState<QuerySnapshot[]>([]);
	const key = ids.slice(0, 30).join(",");
	const uid = user?.uid;

	useEffect(() => {
		setOwn(null);
		setPages([]);
		if (!uid || !key) return;

		const ref = collection(db, "users", uid, "techniques");
		const unsubscribeOwn = onSnapshot(
			query(ref, where(documentId(), "in", key.split(","))),
			(snapshot) =>
				setOwn(
					snapshot.docs.map((d) =>
						fromFirestore(d.id, d.data() as FirestoreTechnique, uid),
					),
				),
		);
		const unsubscribeQueue = onSnapshot(queuePage(uid), (first) =>
			setPages((rest) => [first, ...rest.slice(1)]),
		);
		return () => {
			unsubscribeOwn();
			unsubscribeQueue();
		};
	}, [uid, key]);

	const techniques = useMemo(() => {
		if (!own || !uid || pages.length === 0) return [];
		const seen = new Set(own.map((o) => o.id));
		const queued = pages
			.flatMap((p) => p.docs)
			.filter((d) => !seen.has(d.id) && seen.add(d.id))
			.map((d) => fromFirestore(d.id, d.data() as FirestoreTechnique, uid));
		return [...own, ...queued];
	}, [own, pages, uid]);

	const last = pages.at(-1);
	const showMore =
		uid && last?.size === QUEUE_PAGE
			? async () => {
					const next = await getDocs(
						queuePage(uid, startAfter(last.docs.at(-1))),
					);
					setPages((current) => [...current, next]);
				}
			: undefined;

	return { techniques, showMore };
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
			handsMode?: TechniqueHandsMode;
			activeDrills?: PracticeDrill[];
		} = {},
	) => {
		if (!user) throw new Error("Not authenticated");

		const ref = collection(db, "users", user.uid, "techniques");
		await awaitWrite(
			addDoc(ref, {
				title,
				state: options.state ?? "active",
				type: options.type ?? null,
				targetTempoBpm: options.targetTempoBpm ?? null,
				notes: options.notes ?? null,
				dateIntroduced: new Date(),
				lastPracticedAt: null,
				handsMode: options.handsMode ?? "separate",
				activeDrills: options.activeDrills ?? [],
			}),
		);
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
				| "timeSignature"
				| "notes"
				| "lastPracticedAt"
				| "lastQuality"
				| "lastEffort"
				| "lastAchievedTempoBpm"
				| "byMode"
				| "handsMode"
				| "activeDrills"
			>
		>,
		previousState?: TechniqueState,
	) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		const introduced =
			updates.state === "active" &&
			previousState !== undefined &&
			previousState !== "active";
		await awaitWrite(
			updateDoc(
				ref,
				introduced ? { ...updates, dateIntroduced: new Date() } : updates,
			),
		);
	};

	return { updateTechnique };
}

export function useAdvanceTechnique() {
	const { user } = useAuth();

	const advance = async (fromId: string, toId: string | null) => {
		if (!user) throw new Error("Not authenticated");

		const batch = writeBatch(db);
		batch.update(doc(db, "users", user.uid, "techniques", fromId), {
			state: "maintenance",
			nudgeSnoozedUntil: null,
		});
		if (toId) {
			batch.update(doc(db, "users", user.uid, "techniques", toId), {
				state: "active",
				dateIntroduced: new Date(),
			});
		}
		await awaitWrite(batch.commit());
	};

	return { advance };
}

export function useSnoozeTechniqueNudge() {
	const { user } = useAuth();

	const snooze = async (techniqueId: string, days: number) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		await awaitWrite(
			updateDoc(ref, {
				nudgeSnoozedUntil: new Date(Date.now() + days * 86_400_000),
			}),
		);
	};

	return { snooze };
}

export function useDeleteTechnique() {
	const { user } = useAuth();

	const deleteTechnique = async (techniqueId: string) => {
		if (!user) throw new Error("Not authenticated");

		const ref = doc(db, "users", user.uid, "techniques", techniqueId);
		await awaitWrite(deleteDoc(ref));
	};

	return { deleteTechnique };
}

export function useSaveTechniqueLog() {
	const { user } = useAuth();

	/**
	 * Writes one practice log per mode, then folds them all into `byMode`.
	 */
	const saveTechniqueLog = async (
		techniqueId: string,
		entries: ModeEntry[],
		options: { sessionId?: string | null } = {},
	) => {
		if (!user) throw new Error("Not authenticated");
		if (entries.length === 0) return;

		const now = new Date();
		const techniqueRef = doc(db, "users", user.uid, "techniques", techniqueId);
		const practiceLogsRef = collection(techniqueRef, "practiceLogs");

		await awaitWrite(
			Promise.all(
				entries.map((entry) =>
					addDoc(practiceLogsRef, {
						date: Timestamp.fromDate(now),
						quality: entry.quality,
						effort: entry.effort,
						achievedBpm: entry.bpm ?? null,
						hands: entry.hands,
						drill: entry.drill ?? null,
						sessionId: options.sessionId ?? null,
					}),
				),
			),
		);

		const snap = await getDoc(techniqueRef);
		const byMode = mergeByMode(
			byModeFromFirestore(snap.data()?.byMode),
			entries,
			now,
		);
		const derived = deriveFromByMode(byMode);

		await awaitWrite(
			updateDoc(techniqueRef, {
				byMode,
				lastPracticedAt: derived.lastPracticed ?? now,
				lastQuality: derived.quality,
				lastEffort: derived.effort,
				lastAchievedTempoBpm: derived.bpm,
			}),
		);
	};

	return { saveTechniqueLog };
}
