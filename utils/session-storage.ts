import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import type { ActiveSession } from "@/models/session";
import {
	type PieceListPrefs,
	sanitizePieceListPrefs,
	sanitizeTechniqueListPrefs,
	type TechniqueListPrefs,
} from "./list-prefs";

function activeSessionKey(uid: string): string {
	return `active-session:${uid}`;
}

export async function readActiveSession(
	uid: string,
): Promise<ActiveSession | null> {
	const raw = await AsyncStorage.getItem(activeSessionKey(uid));
	if (!raw) return null;
	try {
		const session = JSON.parse(raw) as ActiveSession;
		if (!session.sessionId) session.sessionId = randomUUID();
		return session;
	} catch {
		return null;
	}
}

export async function writeActiveSession(
	uid: string,
	session: ActiveSession,
): Promise<void> {
	await AsyncStorage.setItem(activeSessionKey(uid), JSON.stringify(session));
}

export async function clearActiveSession(uid: string): Promise<void> {
	await AsyncStorage.removeItem(activeSessionKey(uid));
}

function sightReadingBpmKey(uid: string): string {
	return `sight-reading-bpm:${uid}`;
}

export async function readSightReadingBpm(uid: string): Promise<string | null> {
	return AsyncStorage.getItem(sightReadingBpmKey(uid));
}

export async function writeSightReadingBpm(
	uid: string,
	bpm: string,
): Promise<void> {
	await AsyncStorage.setItem(sightReadingBpmKey(uid), bpm);
}

function installPromptDismissedKey(uid: string): string {
	return `installPromptDismissed:${uid}`;
}

export async function readInstallPromptDismissed(
	uid: string,
): Promise<boolean> {
	return (await AsyncStorage.getItem(installPromptDismissedKey(uid))) === "1";
}

/** "Not now" is final — the install card is never offered to this user again. */
export async function writeInstallPromptDismissed(uid: string): Promise<void> {
	await AsyncStorage.setItem(installPromptDismissedKey(uid), "1");
}

/**
 * Cached derived piece scores, so a cold open can sort by score before the
 * per-piece section listeners have delivered anything.
 */
export interface PieceScoreCache {
	scores: Record<string, number>;
	/** Epoch ms the scores were computed at. */
	computedAt: number;
}

function pieceScoresKey(uid: string): string {
	return `piece-scores:${uid}`;
}

export async function readPieceScores(
	uid: string,
): Promise<PieceScoreCache | null> {
	const raw = await AsyncStorage.getItem(pieceScoresKey(uid));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Partial<PieceScoreCache>;
		if (typeof parsed?.computedAt !== "number") return null;
		if (!parsed.scores || typeof parsed.scores !== "object") return null;
		const scores: Record<string, number> = {};
		for (const [id, value] of Object.entries(parsed.scores)) {
			if (typeof value === "number" && Number.isFinite(value)) {
				scores[id] = value;
			}
		}
		return { scores, computedAt: parsed.computedAt };
	} catch {
		return null;
	}
}

export async function writePieceScores(
	uid: string,
	cache: PieceScoreCache,
): Promise<void> {
	await AsyncStorage.setItem(pieceScoresKey(uid), JSON.stringify(cache));
}

function pieceListPrefsKey(uid: string): string {
	return `pieces-list-prefs:${uid}`;
}

function techniqueListPrefsKey(uid: string): string {
	return `technique-list-prefs:${uid}`;
}

/**
 * Prefs are best-effort: anything unparseable or written by an older schema
 * falls back to the defaults rather than blocking the list from rendering.
 */
async function readPrefs<T>(key: string, sanitize: (raw: unknown) => T | null) {
	const raw = await AsyncStorage.getItem(key);
	if (!raw) return null;
	try {
		return sanitize(JSON.parse(raw));
	} catch {
		return null;
	}
}

export async function readPieceListPrefs(
	uid: string,
): Promise<PieceListPrefs | null> {
	return readPrefs(pieceListPrefsKey(uid), sanitizePieceListPrefs);
}

export async function writePieceListPrefs(
	uid: string,
	prefs: PieceListPrefs,
): Promise<void> {
	await AsyncStorage.setItem(pieceListPrefsKey(uid), JSON.stringify(prefs));
}

export async function readTechniqueListPrefs(
	uid: string,
): Promise<TechniqueListPrefs | null> {
	return readPrefs(techniqueListPrefsKey(uid), sanitizeTechniqueListPrefs);
}

export async function writeTechniqueListPrefs(
	uid: string,
	prefs: TechniqueListPrefs,
): Promise<void> {
	await AsyncStorage.setItem(techniqueListPrefsKey(uid), JSON.stringify(prefs));
}
