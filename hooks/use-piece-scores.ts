import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import { scorePieces } from "@/utils/piece-scoring";
import {
	type PieceScoreCache,
	readPieceScores,
	writePieceScores,
} from "@/utils/session-storage";

/**
 * Scores only move meaningfully when something is practised, so they are cached
 * rather than recomputed on every render. The ceiling keeps the "days since"
 * term from drifting stale during a long-lived session.
 */
export const PIECE_SCORE_MAX_AGE_MS = 30 * 60 * 1000;

/** Newest practice timestamp anywhere in the library, in epoch ms. */
function latestPracticeStamp(pieces: Piece[], sections: Section[]): number {
	let latest = 0;
	for (const piece of pieces) {
		const at = piece.lastPracticed?.getTime() ?? 0;
		if (at > latest) latest = at;
	}
	for (const section of sections) {
		const at = section.lastPracticed?.getTime() ?? 0;
		if (at > latest) latest = at;
		for (const stats of Object.values(section.byMode ?? {})) {
			const modeAt = stats?.lastPracticed?.getTime() ?? 0;
			if (modeAt > latest) latest = modeAt;
		}
	}
	return latest;
}

export function shouldRecomputeScores(
	cache: PieceScoreCache | null,
	pieces: Piece[],
	latestPractice: number,
	now: number,
): boolean {
	if (!cache) return true;
	if (latestPractice > cache.computedAt) return true;
	if (now - cache.computedAt > PIECE_SCORE_MAX_AGE_MS) return true;
	// A piece added since the last computation has no score to sort by.
	return pieces.some((p) => p.id && cache.scores[p.id] === undefined);
}

export interface PieceScores {
	scores: Record<string, number>;
	/** False until either the cache or a fresh computation is available. */
	ready: boolean;
}

/**
 * Derived recommendation score per piece, shared by every surface that orders
 * pieces. Paints from the persisted cache on a cold open and re-scores once the
 * section listeners deliver.
 */
export function usePieceScores(): PieceScores {
	const { user } = useAuth();
	const { pieces } = usePieces();
	const { sections, loading: sectionsLoading } = useAllSections();
	const [cache, setCache] = useState<PieceScoreCache | null>(null);
	const [cacheLoaded, setCacheLoaded] = useState(false);
	const uid = user?.uid ?? null;

	useEffect(() => {
		let alive = true;
		if (!uid) {
			setCache(null);
			setCacheLoaded(true);
			return;
		}
		setCacheLoaded(false);
		readPieceScores(uid).then((stored) => {
			if (!alive) return;
			setCache(stored);
			setCacheLoaded(true);
		});
		return () => {
			alive = false;
		};
	}, [uid]);

	const latestPractice = useMemo(
		() => latestPracticeStamp(pieces, sections),
		[pieces, sections],
	);

	// Scoring before the sections arrive would score every sectioned piece as if
	// it had none, and that wrong number would then be persisted.
	const fresh = useMemo(() => {
		if (!cacheLoaded || sectionsLoading) return null;
		const now = Date.now();
		if (!shouldRecomputeScores(cache, pieces, latestPractice, now)) return null;
		return {
			scores: scorePieces(pieces, sections, new Date(now)),
			computedAt: now,
		};
	}, [cacheLoaded, sectionsLoading, cache, pieces, sections, latestPractice]);

	const persisted = useRef<PieceScoreCache | null>(null);
	useEffect(() => {
		if (!uid || !fresh || persisted.current === fresh) return;
		persisted.current = fresh;
		writePieceScores(uid, fresh);
		setCache(fresh);
	}, [uid, fresh]);

	const active = fresh ?? cache;
	return {
		scores: active?.scores ?? {},
		ready: cacheLoaded && active !== null,
	};
}
