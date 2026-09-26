import { test as setup } from "@playwright/test";
import {
	deleteApp as deleteClientApp,
	initializeApp as initializeClientApp,
} from "firebase/app";
import {
	connectAuthEmulator,
	getAuth as getClientAuth,
	signInWithEmailAndPassword,
} from "firebase/auth";
import {
	collection,
	connectFirestoreEmulator,
	doc,
	type Firestore,
	getDocs,
	getFirestore,
	serverTimestamp,
	setDoc,
	writeBatch,
} from "firebase/firestore";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { PieceState } from "@/models/piece";
import type { SectionState } from "@/models/section";
import type { TechniqueState } from "@/models/technique";
import { SEED_IDS, SEED_USER } from "./support/app";

/**
 * Seeds the emulator programmatically, at the start of every `yarn e2e` — it is
 * the `seed` project in `playwright.config.ts`, and every spec that reads the
 * fixture account depends on it. There is no committed export: dates are
 * computed at run time, so the fixture can express "practised eight days ago"
 * the moment a spec needs it, and every run starts from a rewritten
 * `SEED_USER` even when the emulator suite was already running.
 *
 * The fixture must stay honest about the shapes the app actually writes, so
 * the documents below mirror the add flows field for field —
 * `hooks/use-pieces.ts` `addPiece`, `hooks/use-sections.ts` `addSection`,
 * `hooks/use-techniques.ts` `addTechnique` — and the writes go through the
 * app's own Firebase SDK, signed in as `SEED_USER`, so the Firestore rules are
 * enforced exactly as they are for the app. A hand-invented document shape
 * drifts; a mirrored one cannot.
 *
 * Ids come from `e2e/support/app.ts`, which is what makes them a contract: the
 * same constants build the routes the specs wait on. Overwriting a fixed id
 * twice is what makes the seed idempotent.
 *
 * Cold-start rule (see `.ai/config.toml`): no practice history, so every piece
 * reads as never practised. A warm fixture is a dated practiceLog written here
 * — the run-through shape lives in `hooks/use-practices.ts` `savePractice` —
 * not a new export to babysit.
 */

/** Ports come from firebase.json, like everywhere else that points at the suite. */
const HOST = process.env.EXPO_PUBLIC_EMULATOR_HOST ?? "127.0.0.1";
const AUTH_PORT = 8051;
const FIRESTORE_PORT = 8052;
const PROJECT_ID =
	process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "my-musical-repertoire-dev";

/**
 * Fixed uid, chosen by us rather than minted by the emulator: a saved
 * Playwright storage state (`.tmp/e2e/auth.json` carries the uid) stays valid
 * across an emulator restart, which a freshly minted uid would invalidate on
 * every boot. The Admin SDK can name a uid; the client SDK cannot.
 */
const SEED_UID = "seed-pianist";

/** Firestore caps a batch at 500 writes; stay clear of the edge, as elsewhere. */
const DELETE_BATCH_LIMIT = 450;

/**
 * The repertoire the fixture carries, matching `.ai/config.toml`: four pieces,
 * two techniques, cold-start. The field lists mirror the add flows — see the
 * header comment — not a private idea of what a piece looks like.
 */
const PIECES: {
	id: string;
	title: string;
	composer: string;
	collectionName: string | null;
	state: PieceState;
	targetTempoBpm: number;
	durationSeconds: number;
	sections: {
		id: string;
		label: string;
		state: SectionState;
		startBar: number;
		endBar: number;
	}[];
}[] = [
	{
		id: SEED_IDS.nocturne,
		title: "Nocturne in E-flat major",
		composer: "Frédéric Chopin",
		collectionName: "Nocturnes, Op. 9",
		state: "learning",
		targetTempoBpm: 132,
		durationSeconds: 300,
		sections: [
			{
				id: "seed-nocturne-a",
				label: "A section",
				state: "learning",
				startBar: 1,
				endBar: 16,
			},
			{
				id: "seed-nocturne-b",
				label: "B section",
				state: "learning",
				startBar: 17,
				endBar: 32,
			},
		],
	},
	{
		id: SEED_IDS.invention,
		title: "Invention No. 1 in C major",
		composer: "Johann Sebastian Bach",
		collectionName: "Two-Part Inventions",
		state: "stabilizing",
		targetTempoBpm: 96,
		durationSeconds: 120,
		sections: [
			{
				id: SEED_IDS.exposition,
				label: "Exposition",
				state: "stabilizing",
				startBar: 1,
				endBar: 6,
			},
			{
				id: "seed-invention-middle",
				label: "Middle entries",
				state: "learning",
				startBar: 7,
				endBar: 14,
			},
		],
	},
	{
		id: SEED_IDS.furElise,
		title: "Für Elise",
		composer: "Ludwig van Beethoven",
		collectionName: null,
		state: "maintenance",
		targetTempoBpm: 120,
		durationSeconds: 240,
		sections: [
			{
				id: "seed-fur-elise-theme",
				label: "Main theme",
				state: "maintenance",
				startBar: 1,
				endBar: 22,
			},
		],
	},
	{
		// Deliberately sectionless: the add-section nudge and the empty state
		// need a piece that has never been broken up.
		id: SEED_IDS.gymnopedie,
		title: "Gymnopédie No. 1",
		composer: "Erik Satie",
		collectionName: null,
		state: "learning",
		targetTempoBpm: 60,
		durationSeconds: 240,
		sections: [],
	},
];

const TECHNIQUES: {
	id: string;
	title: string;
	state: TechniqueState;
}[] = [
	{ id: SEED_IDS.scale, title: "C major scale, two octaves", state: "active" },
	{ id: SEED_IDS.hanon, title: "Hanon No. 1", state: "maintenance" },
];

/**
 * Deletes every document under the fixture account, children before parents —
 * the walk `utils/delete-account.ts` does, plus the `phaseTransitions` audit
 * rows. This is what makes a reused emulator irrelevant: whatever a previous
 * run left on `SEED_USER` is gone before anything is written.
 */
async function wipeUserData(db: Firestore) {
	const userRoot = doc(db, "users", SEED_UID);
	const targets: ReturnType<typeof doc>[] = [];

	const pieces = await getDocs(collection(userRoot, "pieces"));
	for (const piece of pieces.docs) {
		const sections = await getDocs(collection(piece.ref, "sections"));
		for (const section of sections.docs) {
			for (const sub of ["practiceLogs", "phaseTransitions"]) {
				const logs = await getDocs(collection(section.ref, sub));
				targets.push(...logs.docs.map((d) => d.ref));
			}
			targets.push(section.ref);
		}
		const logs = await getDocs(collection(piece.ref, "practiceLogs"));
		targets.push(...logs.docs.map((d) => d.ref));
		targets.push(piece.ref);
	}

	const techniques = await getDocs(collection(userRoot, "techniques"));
	for (const technique of techniques.docs) {
		const logs = await getDocs(collection(technique.ref, "practiceLogs"));
		targets.push(...logs.docs.map((d) => d.ref));
		targets.push(technique.ref);
	}

	const presets = await getDocs(collection(userRoot, "sessionPresets"));
	targets.push(...presets.docs.map((d) => d.ref));

	for (let i = 0; i < targets.length; i += DELETE_BATCH_LIMIT) {
		const batch = writeBatch(db);
		for (const ref of targets.slice(i, i + DELETE_BATCH_LIMIT)) {
			batch.delete(ref);
		}
		await batch.commit();
	}
}

setup("seed the emulator fixture", async () => {
	// The Admin SDK talks to the Auth emulator only through this env var, read
	// when the auth service is first created — so it is set before `getAuth`.
	process.env.FIREBASE_AUTH_EMULATOR_HOST = `${HOST}:${AUTH_PORT}`;
	const adminApp = initializeApp({ projectId: PROJECT_ID }, "seed-admin");

	const app = initializeClientApp(
		{ apiKey: "demo-api-key", projectId: PROJECT_ID },
		"seed-client",
	);
	const auth = getClientAuth(app);
	connectAuthEmulator(auth, `http://${HOST}:${AUTH_PORT}`, {
		disableWarnings: true,
	});
	const db = getFirestore(app);
	connectFirestoreEmulator(db, HOST, FIRESTORE_PORT);

	try {
		await getAuth(adminApp).createUser({
			uid: SEED_UID,
			email: SEED_USER.email,
			password: SEED_USER.password,
		});
	} catch (err) {
		const code = (err as { code?: string }).code;
		if (
			code !== "auth/email-already-exists" &&
			code !== "auth/uid-already-exists"
		) {
			throw err;
		}
	}

	try {
		// Signed in as the fixture user, the seed meets the same Firestore rules
		// the app does — an unauthenticated seed would be writing shapes no
		// client could ever write.
		await signInWithEmailAndPassword(auth, SEED_USER.email, SEED_USER.password);
		await wipeUserData(db);

		const userRoot = doc(db, "users", SEED_UID);

		for (const piece of PIECES) {
			await setDoc(doc(userRoot, "pieces", piece.id), {
				title: piece.title,
				composer: piece.composer,
				collectionName: piece.collectionName,
				state: piece.state,
				targetTempoBpm: piece.targetTempoBpm,
				durationSeconds: piece.durationSeconds,
				lastPracticed: null,
				// `addSection` increments this on the piece; a piece that has
				// never been broken up carries no field at all.
				...(piece.sections.length > 0
					? { sectionCount: piece.sections.length }
					: {}),
			});

			for (const [order, section] of piece.sections.entries()) {
				await setDoc(
					doc(userRoot, "pieces", piece.id, "sections", section.id),
					{
						label: section.label,
						state: section.state,
						startBar: section.startBar,
						endBar: section.endBar,
						targetBpmOverride: null,
						notes: null,
						order,
						archived: false,
						createdAt: serverTimestamp(),
					},
				);
			}
		}

		for (const technique of TECHNIQUES) {
			await setDoc(doc(userRoot, "techniques", technique.id), {
				title: technique.title,
				state: technique.state,
				type: null,
				targetTempoBpm: null,
				notes: null,
				dateIntroduced: new Date(),
				lastPracticedAt: null,
				handsMode: "separate",
				activeDrills: [],
			});
		}

		console.log(
			`seed: ${PIECES.length} pieces, ${TECHNIQUES.length} techniques for ${SEED_USER.email} (uid ${SEED_UID})`,
		);
	} finally {
		await deleteClientApp(app);
		await deleteApp(adminApp);
	}
});
