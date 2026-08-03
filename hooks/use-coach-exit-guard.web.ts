import { useCallback, useEffect, useState } from "react";

export interface UseCoachExitGuard {
	/** The "Leave session?" dialog should be open. */
	confirmVisible: boolean;
	/** Close the dialog — the caller decides whether to navigate away after. */
	dismissConfirm: () => void;
}

/** Marks our own history entry, so a `popstate` can be told from a real one. */
const SENTINEL = { coachGuard: true };

/**
 * Traps the browser/system back gesture on the coach screen behind a
 * confirmation, so a stray back swipe cannot drop the user out of a running
 * practice block — in the installed PWA there is no address bar, which makes
 * back the easiest thing to hit by accident.
 *
 * Implemented as a `popstate` sentinel rather than `BackHandler`:
 * react-native-web's `BackHandler` is a stub that only logs, so the
 * `Platform.OS === "android"` branch in `use-up-navigation` never runs on web.
 *
 * Nothing here navigates. Leaving is the caller's job, which keeps the exit on
 * the same `router.replace` path as the toolbar's Exit button — and therefore on
 * the same `use-session-pause` blur handler, so elapsed time stays correct.
 */
export function useCoachExitGuard(enabled: boolean): UseCoachExitGuard {
	const [confirmVisible, setConfirmVisible] = useState(false);

	useEffect(() => {
		if (!enabled || typeof window === "undefined") return;

		window.history.pushState(SENTINEL, "");

		const onPopState = () => {
			// The sentinel was just popped. Push it back so the user stays on the
			// block while they decide.
			window.history.pushState(SENTINEL, "");
			setConfirmVisible(true);
		};
		window.addEventListener("popstate", onPopState);

		return () => {
			window.removeEventListener("popstate", onPopState);
			// The sentinel entry is deliberately left on the stack. Popping it here
			// races the `router.replace` that usually causes this unmount — the pop
			// lands after the replace and throws the user back a page, so leaving
			// the coach for the summary would bounce to Overview instead. The stale
			// entry is harmless: it points at the coach, which redirects out by
			// itself once the session is gone.
		};
	}, [enabled]);

	const dismissConfirm = useCallback(() => setConfirmVisible(false), []);

	return { confirmVisible, dismissConfirm };
}
