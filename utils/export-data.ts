import {
	collection,
	type DocumentReference,
	doc,
	getDocs,
	Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

/** One document from the account's tree, with its id alongside its fields. */
export interface ExportDoc {
	id: string;
	[field: string]: unknown;
}

/** Everything stored for a signed-in account, shaped like its Firestore tree. */
export interface ExportData {
	app: "my-musical-repertoire";
	/** ISO 8601 instant the export was produced. */
	exportedAt: string;
	pieces: ExportDoc[];
	techniques: ExportDoc[];
	sessionPresets: ExportDoc[];
}

/**
 * Firestore Timestamps stringify as bare `{seconds, nanoseconds}`, which no
 * other tool reads; ISO 8601 is the portable spelling.
 */
function toPlain(value: unknown): unknown {
	if (value instanceof Timestamp) return value.toDate().toISOString();
	if (Array.isArray(value)) return value.map(toPlain);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, child]) => [key, toPlain(child)]),
		);
	}
	return value;
}

function docJson(id: string, data: Record<string, unknown>): ExportDoc {
	return {
		id,
		...(toPlain(data) as Record<string, unknown>),
	};
}

async function practiceLogs(parent: DocumentReference): Promise<ExportDoc[]> {
	const logs = await getDocs(collection(parent, "practiceLogs"));
	return logs.docs.map((log) => docJson(log.id, log.data()));
}

/**
 * Reads every document the account owns. A one-shot `getDocs` walk rather than
 * listeners: the export is a deliberate action, and a live snapshot of the
 * whole tree is exactly the breadth the snapshot rule forbids.
 */
export async function collectExportData(uid: string): Promise<ExportData> {
	const userRef = doc(db, "users", uid);

	const pieces: ExportDoc[] = [];
	const pieceDocs = await getDocs(collection(userRef, "pieces"));
	for (const piece of pieceDocs.docs) {
		const sections = await getDocs(collection(piece.ref, "sections"));
		pieces.push({
			...docJson(piece.id, piece.data()),
			sections: await Promise.all(
				sections.docs.map(async (section) => ({
					...docJson(section.id, section.data()),
					practiceLogs: await practiceLogs(section.ref),
				})),
			),
			practiceLogs: await practiceLogs(piece.ref),
		});
	}

	const techniques: ExportDoc[] = [];
	const techniqueDocs = await getDocs(collection(userRef, "techniques"));
	for (const technique of techniqueDocs.docs) {
		techniques.push({
			...docJson(technique.id, technique.data()),
			practiceLogs: await practiceLogs(technique.ref),
		});
	}

	const presets = await getDocs(collection(userRef, "sessionPresets"));

	return {
		app: "my-musical-repertoire",
		exportedAt: new Date().toISOString(),
		pieces,
		techniques,
		sessionPresets: presets.docs.map((preset) =>
			docJson(preset.id, preset.data()),
		),
	};
}
