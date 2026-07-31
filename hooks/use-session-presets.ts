import {
	addDoc,
	collection,
	deleteDoc,
	doc,
	onSnapshot,
	query,
	serverTimestamp,
	updateDoc,
	writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
	DEFAULT_PRESET_SEEDS,
	type DefaultPresetKey,
	missingDefaultSeeds,
	PRESET_LINE_KEYS,
	type PresetLines,
	SCRATCH_PRESET_ID,
	type SessionPreset,
} from "@/models/session-preset";

interface FirestoreSessionPreset {
	name?: string;
	order?: number;
	lines?: unknown;
	scratch?: boolean;
}

/**
 * Seeded built-ins get deterministic ids so a double-fired seed rewrites the
 * same four docs instead of duplicating them.
 */
export function defaultPresetDocId(key: DefaultPresetKey): string {
	return `default-${key}`;
}

/** Drops unknown keys and non-numeric values — a `null` means "line disabled". */
export function linesFromFirestore(raw: unknown): PresetLines {
	if (!raw || typeof raw !== "object") return {};
	const source = raw as Record<string, unknown>;
	const lines: PresetLines = {};
	for (const key of PRESET_LINE_KEYS) {
		const value = source[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			lines[key] = value;
		}
	}
	return lines;
}

export function fromFirestore(
	id: string,
	data: FirestoreSessionPreset,
	userId: string,
): SessionPreset {
	return {
		id,
		userId,
		name: data.name ?? "",
		order: data.order ?? 0,
		lines: linesFromFirestore(data.lines),
		scratch: data.scratch ?? false,
	};
}

export function sortPresets(presets: SessionPreset[]): SessionPreset[] {
	return [...presets].sort((a, b) => {
		if (a.order !== b.order) return a.order - b.order;
		return a.name.localeCompare(b.name);
	});
}

function presetsCollection(uid: string) {
	return collection(db, "users", uid, "sessionPresets");
}

/**
 * Firestore rejects `undefined`, so a disabled line is written as an explicit
 * `null` rather than omitted — that also lets an update clear a line.
 */
function linesToFirestore(lines: PresetLines): Record<string, number | null> {
	const out: Record<string, number | null> = {};
	for (const key of PRESET_LINE_KEYS) {
		const value = lines[key];
		out[key] = value == null ? null : value;
	}
	return out;
}

export function useSessionPresets() {
	const { user } = useAuth();
	const { t } = useTranslation();
	const [all, setAll] = useState<SessionPreset[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (!user) {
			setAll([]);
			setLoading(false);
			return;
		}

		const uid = user.uid;
		// Back to loading: on a direct page load `user` arrives after the first
		// render, and callers that prefill state once must not read the empty
		// list this hook reported while auth was still resolving.
		setLoading(true);
		const q = query(presetsCollection(uid));

		const unsubscribe = onSnapshot(q, (snapshot) => {
			setAll(
				snapshot.docs.map((d) =>
					fromFirestore(d.id, d.data() as FirestoreSessionPreset, uid),
				),
			);
			setLoading(false);

			// Seed once, and only on a server-confirmed empty collection: a
			// brand-new account offline reads an empty cache, and seeding from that
			// would fight the eventual server state. The scratch doc is written in
			// the same batch, so the collection is never empty again — deleting
			// every preset afterwards is allowed and does not re-seed.
			if (snapshot.empty && !snapshot.metadata.fromCache) {
				void seedDefaultPresets(uid, (key) =>
					t(`screen.session.preset.default.${key}` as const),
				);
			}
		});

		return unsubscribe;
	}, [user, t]);

	const presets = useMemo(
		() => sortPresets(all.filter((p) => !p.scratch)),
		[all],
	);
	const scratch = useMemo(() => all.find((p) => p.scratch) ?? null, [all]);

	return { presets, scratch, loading };
}

/**
 * Writes the four built-ins plus the scratch doc in one batch. Deterministic
 * document ids make a repeat call a no-op overwrite rather than a duplicate.
 */
export async function seedDefaultPresets(
	uid: string,
	nameFor: (key: DefaultPresetKey) => string,
): Promise<void> {
	const ref = presetsCollection(uid);
	const batch = writeBatch(db);
	for (const seed of DEFAULT_PRESET_SEEDS) {
		batch.set(doc(ref, defaultPresetDocId(seed.key)), {
			name: nameFor(seed.key),
			order: seed.order,
			lines: linesToFirestore(seed.lines),
			scratch: false,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		});
	}
	batch.set(doc(ref, SCRATCH_PRESET_ID), {
		name: nameFor("balanced"),
		order: 0,
		lines: linesToFirestore(DEFAULT_PRESET_SEEDS[0].lines),
		scratch: true,
		createdAt: serverTimestamp(),
		updatedAt: serverTimestamp(),
	});
	await batch.commit();
}

/**
 * Re-adds built-ins missing by name, leaving every existing preset alone.
 * Restored presets go to the end of the list so a manual reorder survives.
 */
export async function restoreDefaultPresets(
	uid: string,
	existing: SessionPreset[],
	nameFor: (key: DefaultPresetKey) => string,
): Promise<number> {
	// The scratch doc is not a preset — its name never satisfies a built-in.
	const named = existing.filter((p) => !p.scratch);
	const missing = missingDefaultSeeds(
		named.map((p) => p.name),
		nameFor,
	);
	if (missing.length === 0) return 0;

	const ref = presetsCollection(uid);
	const batch = writeBatch(db);
	let order = named.reduce((max, p) => Math.max(max, p.order), -1) + 1;
	for (const seed of missing) {
		batch.set(doc(ref, defaultPresetDocId(seed.key)), {
			name: nameFor(seed.key),
			order: order++,
			lines: linesToFirestore(seed.lines),
			scratch: false,
			createdAt: serverTimestamp(),
			updatedAt: serverTimestamp(),
		});
	}
	await batch.commit();
	return missing.length;
}

export function useSessionPresetActions() {
	const { user } = useAuth();
	const { t } = useTranslation();

	const nameFor = useCallback(
		(key: DefaultPresetKey) =>
			t(`screen.session.preset.default.${key}` as const),
		[t],
	);

	const addPreset = useCallback(
		async (name: string, lines: PresetLines, order?: number) => {
			if (!user) throw new Error("Not authenticated");
			const created = await addDoc(presetsCollection(user.uid), {
				name,
				// Callers that know the list pass an explicit order; the fallback
				// just parks the preset at the end.
				order: order ?? Date.now(),
				lines: linesToFirestore(lines),
				scratch: false,
				createdAt: serverTimestamp(),
				updatedAt: serverTimestamp(),
			});
			return created.id;
		},
		[user],
	);

	const updatePreset = useCallback(
		async (
			presetId: string,
			updates: { name?: string; order?: number; lines?: PresetLines },
		) => {
			if (!user) throw new Error("Not authenticated");
			const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
			if (updates.name !== undefined) payload.name = updates.name;
			if (updates.order !== undefined) payload.order = updates.order;
			if (updates.lines !== undefined)
				payload.lines = linesToFirestore(updates.lines);
			await updateDoc(doc(presetsCollection(user.uid), presetId), payload);
		},
		[user],
	);

	const deletePreset = useCallback(
		async (presetId: string) => {
			if (!user) throw new Error("Not authenticated");
			await deleteDoc(doc(presetsCollection(user.uid), presetId));
		},
		[user],
	);

	/** Reorder writes the whole list so `order` stays a dense 0..n-1 range. */
	const reorderPresets = useCallback(
		async (orderedIds: string[]) => {
			if (!user) throw new Error("Not authenticated");
			const ref = presetsCollection(user.uid);
			const batch = writeBatch(db);
			orderedIds.forEach((id, index) => {
				batch.update(doc(ref, id), {
					order: index,
					updatedAt: serverTimestamp(),
				});
			});
			await batch.commit();
		},
		[user],
	);

	/** The Custom row remembers its last values in one fixed scratch doc. */
	const saveScratchPreset = useCallback(
		async (lines: PresetLines, name?: string) => {
			if (!user) throw new Error("Not authenticated");
			await setScratchDoc(user.uid, lines, name);
		},
		[user],
	);

	const restoreDefaults = useCallback(
		async (existing: SessionPreset[]) => {
			if (!user) throw new Error("Not authenticated");
			return restoreDefaultPresets(user.uid, existing, nameFor);
		},
		[user, nameFor],
	);

	return {
		addPreset,
		updatePreset,
		deletePreset,
		reorderPresets,
		saveScratchPreset,
		restoreDefaults,
	};
}

async function setScratchDoc(
	uid: string,
	lines: PresetLines,
	name?: string,
): Promise<void> {
	const ref = doc(presetsCollection(uid), SCRATCH_PRESET_ID);
	const batch = writeBatch(db);
	batch.set(
		ref,
		{
			...(name !== undefined ? { name } : {}),
			order: 0,
			lines: linesToFirestore(lines),
			scratch: true,
			updatedAt: serverTimestamp(),
		},
		{ merge: true },
	);
	await batch.commit();
}
