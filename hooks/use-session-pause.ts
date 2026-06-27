import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { ActiveSession } from "@/models/session";
import { pauseSession, resumeSession } from "@/utils/session-timing";

interface UseSessionPauseArgs {
	session: ActiveSession | null;
	setSession: (session: ActiveSession) => void;
	persist: (session: ActiveSession) => Promise<void>;
	loaded: boolean;
}

/**
 * Pauses the practice timer whenever the user leaves the coach screen — by
 * navigating away, backgrounding the app, or hiding the browser tab — and
 * resumes it on return. On resume the session total continues from where it
 * left off while the current block timer resets to 0. See
 * {@link pauseSession}/{@link resumeSession} for the re-anchor math.
 */
export function useSessionPause({
	session,
	setSession,
	persist,
	loaded,
}: UseSessionPauseArgs): void {
	const sessionRef = useRef(session);
	sessionRef.current = session;
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const commit = useCallback(
		(next: ActiveSession, updateState: boolean) => {
			sessionRef.current = next;
			// Storage is the source of truth for the next mount; always persist.
			void persist(next);
			// Only resume updates the visible UI — pause happens while leaving/hidden.
			if (updateState && mountedRef.current) setSession(next);
		},
		[persist, setSession],
	);

	const pause = useCallback(() => {
		const current = sessionRef.current;
		if (!current) return;
		const next = pauseSession(current, new Date().toISOString());
		if (next !== current) commit(next, false);
	}, [commit]);

	const resume = useCallback(() => {
		const current = sessionRef.current;
		if (!current) return;
		const next = resumeSession(current, new Date().toISOString());
		if (next !== current) commit(next, true);
	}, [commit]);

	// Resume on (re)focus, pause on blur / unmount (covers navigate-away).
	useFocusEffect(
		useCallback(() => {
			resume();
			return () => {
				pause();
			};
		}, [resume, pause]),
	);

	// Pause/resume on app background/foreground while the screen stays mounted.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
			if (state === "active") resume();
			else if (state === "background") pause();
		});
		return () => sub.remove();
	}, [resume, pause]);

	// Cold start / fresh mount: re-anchor once the persisted session has loaded
	// (e.g. reopened directly into the coach, or via the Overview "Resume" banner).
	useEffect(() => {
		if (loaded) resume();
	}, [loaded, resume]);
}
