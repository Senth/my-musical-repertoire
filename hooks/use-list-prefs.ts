import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Loads persisted list preferences for the signed-in user and writes back every
 * change. Until the stored value arrives the caller renders with the defaults,
 * so the list is never blocked on storage.
 */
export function useListPrefs<T>(
	defaults: T,
	read: (uid: string) => Promise<T | null>,
	write: (uid: string, prefs: T) => Promise<void>,
): {
	prefs: T;
	setPrefs: (next: T | ((prev: T) => T)) => void;
	loaded: boolean;
} {
	const { user } = useAuth();
	const uid = user?.uid ?? null;
	const [prefs, setPrefsState] = useState<T>(defaults);
	const [loaded, setLoaded] = useState(false);
	const current = useRef(prefs);
	current.current = prefs;
	// Guards against a slow read landing on top of an edit the user already made.
	const dirty = useRef(false);
	// Held in refs so a caller passing inline functions cannot make the load
	// effect re-run and reset the prefs it just restored.
	const config = useRef({ defaults, read, write });
	config.current = { defaults, read, write };

	useEffect(() => {
		let alive = true;
		dirty.current = false;
		setLoaded(false);
		setPrefsState(config.current.defaults);
		if (!uid) {
			setLoaded(true);
			return;
		}
		config.current.read(uid).then((stored) => {
			if (!alive) return;
			if (stored && !dirty.current) setPrefsState(stored);
			setLoaded(true);
		});
		return () => {
			alive = false;
		};
	}, [uid]);

	const setPrefs = useCallback(
		(next: T | ((prev: T) => T)) => {
			const value =
				typeof next === "function"
					? (next as (p: T) => T)(current.current)
					: next;
			dirty.current = true;
			current.current = value;
			setPrefsState(value);
			if (uid) config.current.write(uid, value);
		},
		[uid],
	);

	return { prefs, setPrefs, loaded };
}
