import { useFocusEffect } from "expo-router";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSightReadingPage } from "@/hooks/use-sight-reading-logs";

interface HistorySession {
	active: boolean;
	busy: boolean;
	initialized: boolean;
	hasMore: boolean;
	cursor?: QueryDocumentSnapshot;
}

export function useSightReadingHistory() {
	const { user } = useAuth();
	const uid = user?.uid;
	const session = useRef<HistorySession | null>(null);
	const [state, setState] = useState({
		uid,
		entries: [] as Awaited<ReturnType<typeof fetchSightReadingPage>>["entries"],
		loading: !!uid,
		hasMore: false,
		error: null as Error | null,
	});
	const loadMore = useCallback(async () => {
		const current = session.current;
		if (
			!uid ||
			!current?.active ||
			current.busy ||
			(current.initialized && !current.hasMore)
		)
			return;
		current.busy = true;
		setState((previous) => ({ ...previous, loading: true, error: null }));
		try {
			const page = await fetchSightReadingPage(uid, current.cursor);
			if (!current.active) return;
			current.cursor = page.cursor;
			current.hasMore = page.hasMore;
			current.initialized = true;
			setState((previous) => ({
				...previous,
				entries: [...previous.entries, ...page.entries],
				hasMore: page.hasMore,
			}));
		} catch (error) {
			if (current.active)
				setState((previous) => ({
					...previous,
					error: error instanceof Error ? error : new Error(String(error)),
				}));
		} finally {
			current.busy = false;
			if (current.active)
				setState((previous) => ({ ...previous, loading: false }));
		}
	}, [uid]);
	useFocusEffect(
		useCallback(() => {
			const current: HistorySession = {
				active: true,
				busy: false,
				initialized: false,
				hasMore: false,
			};
			session.current = current;
			setState({
				uid,
				entries: [],
				loading: !!uid,
				hasMore: false,
				error: null,
			});
			if (uid) void loadMore();
			return () => {
				current.active = false;
			};
		}, [uid, loadMore]),
	);
	const visible =
		state.uid === uid
			? state
			: {
					entries: [],
					loading: !!uid,
					hasMore: false,
					error: null,
				};
	return { ...visible, loadMore };
}
