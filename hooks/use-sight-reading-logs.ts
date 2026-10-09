import {
	addDoc,
	collection,
	getDocs,
	limit,
	orderBy,
	type QueryDocumentSnapshot,
	query,
	startAfter,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import {
	normalizeSightReadingLog,
	type SightReadingLog,
} from "@/models/sight-reading";
import { awaitWrite } from "@/utils/firestore-write";
import { PAGE_SIZE } from "@/utils/practice-history";

export async function addSightReadingLog(
	uid: string,
	log: Omit<SightReadingLog, "id">,
): Promise<void> {
	await awaitWrite(
		addDoc(collection(db, "users", uid, "sightReadingLogs"), {
			date: Timestamp.fromDate(log.date),
			elapsedSeconds: log.elapsedSeconds,
			achievedBpm: log.achievedBpm ?? null,
			keptGoing: log.keptGoing ?? null,
		}),
	);
}

export async function fetchSightReadingPage(
	uid: string,
	cursor?: QueryDocumentSnapshot,
) {
	const snapshot = await getDocs(
		query(
			collection(db, "users", uid, "sightReadingLogs"),
			orderBy("date", "desc"),
			limit(PAGE_SIZE),
			...(cursor ? [startAfter(cursor)] : []),
		),
	);
	return {
		entries: snapshot.docs.map((doc) => ({
			...normalizeSightReadingLog(doc.data()),
			id: doc.id,
		})),
		cursor: snapshot.docs[snapshot.docs.length - 1],
		hasMore: snapshot.docs.length === PAGE_SIZE,
	};
}

export async function fetchLastSightReading(
	uid: string,
): Promise<SightReadingLog | null> {
	const snapshot = await getDocs(
		query(
			collection(db, "users", uid, "sightReadingLogs"),
			orderBy("date", "desc"),
			limit(1),
		),
	);
	const doc = snapshot.docs[0];
	return doc ? { ...normalizeSightReadingLog(doc.data()), id: doc.id } : null;
}
