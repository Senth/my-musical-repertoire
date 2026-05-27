import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
	ActiveSession,
	SessionEmphasis,
	SessionInputs,
} from "@/models/session";

function sessionInputsKey(uid: string, emphasis: SessionEmphasis): string {
	return `session-inputs:${uid}:${emphasis}`;
}

function activeSessionKey(uid: string): string {
	return `active-session:${uid}`;
}

export async function readSessionInputs(
	uid: string,
	emphasis: SessionEmphasis,
): Promise<SessionInputs | null> {
	const raw = await AsyncStorage.getItem(sessionInputsKey(uid, emphasis));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as SessionInputs;
	} catch {
		return null;
	}
}

export async function writeSessionInputs(
	uid: string,
	inputs: SessionInputs,
): Promise<void> {
	await AsyncStorage.setItem(
		sessionInputsKey(uid, inputs.emphasis),
		JSON.stringify(inputs),
	);
}

export async function readActiveSession(
	uid: string,
): Promise<ActiveSession | null> {
	const raw = await AsyncStorage.getItem(activeSessionKey(uid));
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ActiveSession;
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
