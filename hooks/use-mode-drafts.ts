import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	ByMode,
	HandsMode,
	ModeKey,
	PracticeDrill,
} from "@/models/practice";
import {
	type ModeEntry,
	modeKey,
	parseModeKey,
	pickPreselectedHands,
} from "@/utils/practice-modes";

type Rating = 1 | 2 | 3 | 4 | 5;

export interface ModeDraft {
	bpm: string;
	quality: Rating | null;
	effort: Rating | null;
}

const EMPTY_DRAFT: ModeDraft = { bpm: "", quality: null, effort: null };

interface UseModeDraftsArgs {
	byMode: ByMode | null | undefined;
	available: HandsMode[];
	drills: PracticeDrill[];
	effectiveTarget: number | null;
	/** Seed once the item has loaded — seeding runs a single time. */
	ready: boolean;
}

function seedDrafts(
	byMode: ByMode | null | undefined,
	available: HandsMode[],
	drills: PracticeDrill[],
): Record<ModeKey, ModeDraft> {
	const drafts: Record<ModeKey, ModeDraft> = {};
	for (const hands of available) {
		for (const drill of [null, ...drills]) {
			const key = modeKey(hands, drill);
			drafts[key] = {
				bpm: byMode?.[key]?.bpm?.toString() ?? "",
				// Ratings never carry over — a stale 3 is a rating the student never gave.
				quality: null,
				effort: null,
			};
		}
	}
	return drafts;
}

function isComplete(draft: ModeDraft | undefined): boolean {
	return draft?.quality != null && draft?.effort != null;
}

export function parseBpm(text: string): number | null {
	const trimmed = text.trim();
	if (!trimmed) return null;
	return Number.parseInt(trimmed, 10) || null;
}

/**
 * Holds one draft per practice mode, tracks which ones the student touched, and
 * turns the complete ones into save entries. Switching chips only changes which
 * draft is on screen — nothing is written until Save.
 */
export function useModeDrafts({
	byMode,
	available,
	drills,
	effectiveTarget,
	ready,
}: UseModeDraftsArgs) {
	const [drafts, setDrafts] = useState<Record<ModeKey, ModeDraft>>({});
	const [dirty, setDirty] = useState<Set<ModeKey>>(() => new Set());
	const [hands, setHands] = useState<HandsMode>("LH");
	const [drill, setDrill] = useState<PracticeDrill | null>(null);
	const seeded = useRef(false);

	useEffect(() => {
		if (!ready || seeded.current) return;
		setDrafts(seedDrafts(byMode, available, drills));
		setHands(pickPreselectedHands(byMode, available, effectiveTarget));
		seeded.current = true;
	}, [ready, byMode, available, drills, effectiveTarget]);

	const currentKey = modeKey(hands, drill);
	const draft = drafts[currentKey] ?? EMPTY_DRAFT;

	const patch = useCallback(
		(changes: Partial<ModeDraft>) => {
			setDrafts((prev) => ({
				...prev,
				[currentKey]: { ...(prev[currentKey] ?? EMPTY_DRAFT), ...changes },
			}));
			// Sticky: reverting a value does not undo the intent to log this mode.
			setDirty((prev) =>
				prev.has(currentKey) ? prev : new Set(prev).add(currentKey),
			);
		},
		[currentKey],
	);

	const setBpm = useCallback((bpm: string) => patch({ bpm }), [patch]);
	const setQuality = useCallback(
		(quality: Rating) => patch({ quality }),
		[patch],
	);
	const setEffort = useCallback((effort: Rating) => patch({ effort }), [patch]);

	const entries: ModeEntry[] = useMemo(
		() =>
			Object.entries(drafts)
				.filter(([, d]) => isComplete(d))
				.map(([key, d]) => {
					const { hands: h, drill: dr } = parseModeKey(key);
					return {
						hands: h,
						drill: dr,
						bpm: parseBpm(d.bpm),
						quality: d.quality as Rating,
						effort: d.effort as Rating,
					};
				}),
		[drafts],
	);

	/**
	 * The mode that blocks Save: the first touched-but-unrated one, or the mode
	 * on screen when nothing at all has been rated. `null` means Save is allowed.
	 */
	const blockingKey = useMemo((): ModeKey | null => {
		for (const [key, d] of Object.entries(drafts)) {
			if (dirty.has(key) && !isComplete(d)) return key;
		}
		return entries.length === 0 ? currentKey : null;
	}, [drafts, dirty, entries, currentKey]);

	const selectMode = useCallback((key: ModeKey) => {
		const { hands: h, drill: d } = parseModeKey(key);
		setHands(h);
		setDrill(d);
	}, []);

	return {
		hands,
		setHands,
		drill,
		setDrill,
		currentKey,
		draft,
		drafts,
		setBpm,
		setQuality,
		setEffort,
		entries,
		blockingKey,
		selectMode,
	};
}
