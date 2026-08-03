import { Platform } from "react-native";

/** `navigator.onLine === false`; anything we cannot ask is assumed connected. */
function isOffline(): boolean {
	if (Platform.OS !== "web") return false;
	if (typeof navigator === "undefined") return false;
	return navigator.onLine === false;
}

/**
 * Awaits a Firestore write, but only while there is a connection.
 *
 * A write promise resolves on *server* acknowledgement. The SDK has already
 * committed the write to its local cache (IndexedDB, with
 * `persistentLocalCache`) and will replay it on reconnect, so awaiting the
 * promise offline blocks until the network returns — which strands the user on a
 * spinning Save button and, worse, stops the coach advancing to the next block.
 *
 * Offline the local commit counts as done and the queue drains in the
 * background. Online the await stays, so genuine failures — permission denied,
 * validation — still reach the caller's error handling.
 *
 * Callers therefore get "durably recorded", not "stored on the server". Nothing
 * in the app needs the stronger guarantee: every list reads through
 * `onSnapshot`, which already reflects pending local writes.
 */
export async function awaitWrite(write: Promise<unknown>): Promise<void> {
	if (isOffline()) {
		// Still attach a handler: an unobserved rejection would surface as an
		// unhandled promise rejection instead of being retried by the SDK.
		void write.catch(() => {});
		return;
	}
	await write;
}

/**
 * {@link awaitWrite} for a write whose result the caller needs (e.g. the new
 * document reference). Offline the value is unavailable, so it resolves `null`.
 */
export async function awaitWriteResult<T>(
	write: Promise<T>,
): Promise<T | null> {
	if (isOffline()) {
		void write.catch(() => {});
		return null;
	}
	return await write;
}
