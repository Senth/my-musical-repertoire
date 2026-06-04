import type { User } from "firebase/auth";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import type { ActiveSession } from "@/models/session";
import { readActiveSession } from "@/utils/session-storage";

interface UseActiveSession {
	session: ActiveSession | null;
	setSession: Dispatch<SetStateAction<ActiveSession | null>>;
	loaded: boolean;
}

/**
 * Loads the persisted active session for the signed-in user once on mount.
 * Returns the session, a setter (for screens that advance it), and a `loaded`
 * flag that is true once the read completes (or immediately when signed out).
 */
export function useActiveSession(user: User | null): UseActiveSession {
	const [session, setSession] = useState<ActiveSession | null>(null);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		let active = true;
		(async () => {
			if (!user) {
				setLoaded(true);
				return;
			}
			const s = await readActiveSession(user.uid);
			if (!active) return;
			setSession(s);
			setLoaded(true);
		})();
		return () => {
			active = false;
		};
	}, [user]);

	return { session, setSession, loaded };
}
