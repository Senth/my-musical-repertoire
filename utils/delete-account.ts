import {
	collection,
	type DocumentReference,
	doc,
	getDocs,
	writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase";

/** Firestore caps a batch at 500 writes; stay clear of the edge. */
const DELETE_BATCH_LIMIT = 450;

/**
 * Every document that belongs to a user, children before parents.
 *
 * Firestore has no cascading delete, so each subcollection has to be walked by
 * hand — anything missed stays behind as an unreachable orphan that the user
 * can never see or remove again.
 */
async function collectUserDocs(uid: string): Promise<DocumentReference[]> {
	const userRef = doc(db, "users", uid);
	const targets: DocumentReference[] = [];

	const pieces = await getDocs(collection(userRef, "pieces"));
	for (const piece of pieces.docs) {
		const sections = await getDocs(collection(piece.ref, "sections"));
		for (const section of sections.docs) {
			const logs = await getDocs(collection(section.ref, "practiceLogs"));
			targets.push(...logs.docs.map((d) => d.ref));
			targets.push(section.ref);
		}
		const pieceLogs = await getDocs(collection(piece.ref, "practiceLogs"));
		targets.push(...pieceLogs.docs.map((d) => d.ref));
		targets.push(piece.ref);
	}

	const techniques = await getDocs(collection(userRef, "techniques"));
	for (const technique of techniques.docs) {
		const logs = await getDocs(collection(technique.ref, "practiceLogs"));
		targets.push(...logs.docs.map((d) => d.ref));
		targets.push(technique.ref);
	}

	const presets = await getDocs(collection(userRef, "sessionPresets"));
	targets.push(...presets.docs.map((d) => d.ref));

	return targets;
}

/**
 * Deletes everything stored for a user in Firestore.
 *
 * Deliberately awaits every batch rather than going through `awaitWrite`:
 * account deletion must be confirmed by the server before the auth user is
 * removed, because once that happens the security rules reject any leftover
 * write and the data would be stranded forever.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
	const targets = await collectUserDocs(uid);

	for (let i = 0; i < targets.length; i += DELETE_BATCH_LIMIT) {
		const batch = writeBatch(db);
		for (const ref of targets.slice(i, i + DELETE_BATCH_LIMIT)) {
			batch.delete(ref);
		}
		await batch.commit();
	}
}
