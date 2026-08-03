import { useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { readActiveSession } from "@/utils/session-storage";

/**
 * Whether a practice session is in progress, for the app-level chrome that must
 * stay out of the way during one (the update banner, the install card).
 *
 * Re-read on every navigation rather than polled: the root layout has no screen
 * focus of its own, and a session can only start or end by changing route.
 */
export function useHasActiveSession(): boolean {
	const { user } = useAuth();
	const segments = useSegments();
	const route = segments.join("/");
	const [hasSession, setHasSession] = useState(false);

	// `route` is a re-run trigger, not an input: a session can only start or end
	// by navigating, and the root layout has no screen focus of its own to hook.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-run trigger
	useEffect(() => {
		if (!user) {
			setHasSession(false);
			return;
		}
		let active = true;
		(async () => {
			const session = await readActiveSession(user.uid);
			if (active) setHasSession(session !== null);
		})();
		return () => {
			active = false;
		};
	}, [user, route]);

	return hasSession;
}
