import { useFocusEffect } from "expo-router";
import {
	collection,
	getDocs,
	limit,
	orderBy,
	type QueryDocumentSnapshot,
	query,
	startAfter,
	where,
} from "firebase/firestore";
import { useCallback, useRef, useState } from "react";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useSections } from "@/hooks/use-sections";
import type { Section } from "@/models/section";
import {
	type HistoryEntry,
	type HistoryStream,
	type LastLogScope,
	mergeHistoryPage,
	normalizeHistoryLog,
	PAGE_SIZE,
} from "@/utils/practice-history";

export type HistorySection = Pick<
	Section,
	"label" | "order" | "archived" | "startBar" | "endBar"
> & { id: string };
type HistoryScope = Exclude<LastLogScope, { type: "section" }>;

interface HistorySession {
	active: boolean;
	busy: boolean;
	initialized: boolean;
	streams: HistoryStream[];
	cursors: (QueryDocumentSnapshot | undefined)[];
	refill: number[];
}

export function usePracticeHistory(scope: HistoryScope) {
	const { user } = useAuth();
	const uid = user?.uid;
	const type = scope.type;
	const pieceId = scope.type === "piece" ? scope.pieceId : "";
	const techniqueId = scope.type === "technique" ? scope.techniqueId : "";
	const live = useSections(pieceId);
	const waitingForSections = type === "piece" && live.loading;
	const liveSections =
		type === "piece"
			? live.sections.filter(
					(section): section is Section & { id: string } =>
						section.pieceId === pieceId && !!section.id,
				)
			: [];
	const sectionIds = JSON.stringify(liveSections.map((section) => section.id));
	const key = JSON.stringify([uid, type, pieceId, techniqueId]);
	const session = useRef<HistorySession | null>(null);
	const [state, setState] = useState({
		key,
		entries: [] as HistoryEntry[],
		archived: [] as HistorySection[],
		loading: true,
		hasMore: false,
		error: null as Error | null,
	});

	const loadMore = useCallback(async () => {
		const current = session.current;
		if (
			!uid ||
			!(pieceId || techniqueId) ||
			waitingForSections ||
			!current?.active ||
			current.busy ||
			(current.initialized &&
				!current.streams.some((stream) => stream.hasMore || stream.logs.length))
		)
			return;
		current.busy = true;
		setState((previous) => ({ ...previous, loading: true, error: null }));
		const readStreams = async (indices: number[]) => {
			const fetched = await Promise.all(
				indices.map(async (index) => {
					const stream = current.streams[index];
					const parent =
						stream.scope.type === "technique"
							? ["techniques", stream.scope.techniqueId]
							: [
									"pieces",
									stream.scope.pieceId,
									...(stream.scope.type === "section"
										? ["sections", stream.scope.sectionId]
										: []),
								];
					const cursor = current.cursors[index];
					const snapshot = await getDocs(
						query(
							collection(db, "users", uid, ...parent, "practiceLogs"),
							orderBy("date", "desc"),
							limit(PAGE_SIZE),
							...(cursor ? [startAfter(cursor)] : []),
						),
					);
					return {
						index,
						stream: {
							...stream,
							logs: [
								...stream.logs,
								...snapshot.docs.map((doc) =>
									normalizeHistoryLog(
										{ id: doc.id, data: doc.data() },
										stream.scope.type,
									),
								),
							],
							hasMore: snapshot.docs.length === PAGE_SIZE,
						},
						cursor: snapshot.docs[snapshot.docs.length - 1] ?? cursor,
					};
				}),
			);
			if (!current.active) return;
			for (const result of fetched) {
				current.streams[result.index] = result.stream;
				current.cursors[result.index] = result.cursor;
			}
		};
		try {
			if (!current.initialized) {
				const archived: HistorySection[] = [];
				if (type === "piece") {
					let cursor: QueryDocumentSnapshot | undefined;
					while (current.active) {
						const snapshot = await getDocs(
							query(
								collection(db, "users", uid, "pieces", pieceId, "sections"),
								where("archived", "==", true),
								orderBy("order", "asc"),
								limit(PAGE_SIZE),
								...(cursor ? [startAfter(cursor)] : []),
							),
						);
						for (const doc of snapshot.docs) {
							const data = doc.data();
							archived.push({
								id: doc.id,
								label: data.label,
								order: data.order,
								archived: true,
								startBar: data.startBar ?? null,
								endBar: data.endBar ?? null,
							});
						}
						if (snapshot.docs.length < PAGE_SIZE) break;
						cursor = snapshot.docs[snapshot.docs.length - 1];
					}
				}
				if (!current.active) return;
				const scopes: LastLogScope[] =
					type === "technique"
						? [{ type, techniqueId }]
						: [
								{ type, pieceId },
								...[
									...new Set([
										...(JSON.parse(sectionIds) as string[]),
										...archived.map((section) => section.id),
									]),
								].map((sectionId) => ({
									type: "section" as const,
									pieceId,
									sectionId,
								})),
							];
				current.streams = scopes.map((scope) => ({
					scope,
					logs: [],
					hasMore: true,
				}));
				current.cursors = [];
				await readStreams(current.streams.map((_, index) => index));
				if (!current.active) return;
				current.initialized = true;
				setState((previous) => ({ ...previous, archived }));
			} else if (current.refill.length) {
				await readStreams(current.refill);
			}
			if (!current.active) return;
			let page = mergeHistoryPage(current.streams);
			while (!page.entries.length && page.refill.length && current.active) {
				await readStreams(page.refill);
				page = mergeHistoryPage(current.streams);
			}
			if (!current.active) return;
			current.streams = page.streams;
			current.refill = page.refill;
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
	}, [uid, type, pieceId, techniqueId, sectionIds, waitingForSections]);

	useFocusEffect(
		useCallback(() => {
			const current: HistorySession = {
				active: true,
				busy: false,
				initialized: false,
				streams: [],
				cursors: [],
				refill: [],
			};
			session.current = current;
			const ready = !!uid && !!(pieceId || techniqueId);
			setState({
				key,
				entries: [],
				archived: [],
				loading: ready,
				hasMore: false,
				error: null,
			});
			if (ready && !waitingForSections) void loadMore();
			return () => {
				current.active = false;
			};
		}, [key, uid, pieceId, techniqueId, waitingForSections, loadMore]),
	);

	const visible =
		state.key === key
			? state
			: {
					entries: [],
					archived: [],
					loading: !!uid,
					hasMore: false,
					error: null,
				};
	const sections: HistorySection[] = !uid
		? []
		: [
				...liveSections,
				...visible.archived.filter(
					(section) => !liveSections.some((live) => live.id === section.id),
				),
			].sort(
				(a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order,
			);
	return {
		entries: visible.entries,
		sections,
		loading: visible.loading,
		hasMore: visible.hasMore,
		loadMore,
		error: visible.error,
	};
}
