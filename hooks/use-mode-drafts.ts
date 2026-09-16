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

/** One interval per screen; each tick credits the mode currently selected. */
const CLOCK_TICK_MS = 1000;
/** Cumulative active time with a mode selected that counts as touching it. */
const TOUCHED_MS = 90_000;

interface UseModeDraftsArgs {
	byMode: ByMode | null | undefined;
	available: HandsMode[];
	drills: PracticeDrill[];
	effectiveTarget: number | null;
	/**
	 * Mode to open on, overriding the built-in preselect. The session coach passes
	 * the mode that made the block worth planning, so the student lands on the
	 * hand and drill that earned the slot. Ignored when unreachable.
	 */
	preselect?: ModeKey | null;
	/** Seed once the item has loaded — seeding runs a single time. */
	ready: boolean;
	/**
	 * A tempo typed into the piece-level field before the item finished loading
	 * (#121). Seeding writes it into the opened mode's draft instead of the
	 * stored value, so the student's entry survives the scope switch.
	 */
	carryBpm?: string | null;
	/**
	 * False while the coach session is paused or the screen is unfocused. A
	 * clock that runs in a pocket is measuring the pocket, not the practice.
	 */
	clockRunning?: boolean;
}

/** A preselect only wins when the chips can actually reach it. */
function reachablePreselect(
	preselect: ModeKey | null | undefined,
	available: HandsMode[],
	drills: PracticeDrill[],
): { hands: HandsMode; drill: PracticeDrill | null } | null {
	if (!preselect) return null;
	const { hands, drill } = parseModeKey(preselect);
	if (!available.includes(hands)) return null;
	if (drill && !drills.includes(drill)) return null;
	return { hands, drill };
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
	preselect,
	ready,
	carryBpm,
	clockRunning = true,
}: UseModeDraftsArgs) {
	const [drafts, setDrafts] = useState<Record<ModeKey, ModeDraft>>({});
	const [dirty, setDirty] = useState<Set<ModeKey>>(() => new Set());
	const [hands, setHands] = useState<HandsMode>("LH");
	const [drill, setDrill] = useState<PracticeDrill | null>(null);
	const seeded = useRef(false);

	useEffect(() => {
		if (!ready || seeded.current) return;
		const forced = reachablePreselect(preselect, available, drills);
		const openHands = forced
			? forced.hands
			: pickPreselectedHands(byMode, available, effectiveTarget);
		const openDrill = forced ? forced.drill : null;
		const seededDrafts = seedDrafts(byMode, available, drills);
		if (carryBpm) {
			const key = modeKey(openHands, openDrill);
			seededDrafts[key] = { ...seededDrafts[key], bpm: carryBpm };
		}
		setDrafts(seededDrafts);
		setHands(openHands);
		setDrill(openDrill);
		seeded.current = true;
	}, [ready, byMode, available, drills, effectiveTarget, preselect, carryBpm]);

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

	// The clock is cumulative per mode, so leaving and returning to a hand adds
	// up. `lastTickRef` is re-anchored whenever the interval (re)starts, which
	// is what keeps paused or unfocused gaps out of the total.
	const activeMsRef = useRef<Record<ModeKey, number>>({});
	const lastTickRef = useRef<number | null>(null);
	const currentKeyRef = useRef(currentKey);
	const draftsRef = useRef(drafts);
	useEffect(() => {
		currentKeyRef.current = currentKey;
	}, [currentKey]);
	useEffect(() => {
		draftsRef.current = drafts;
	}, [drafts]);

	useEffect(() => {
		if (!ready || !clockRunning) return;
		lastTickRef.current = Date.now();
		const id = setInterval(() => {
			const now = Date.now();
			const elapsed = now - (lastTickRef.current ?? now);
			lastTickRef.current = now;
			const key = currentKeyRef.current;
			const d = draftsRef.current[key];
			if (d?.quality != null && d?.effort != null) return;
			const next = (activeMsRef.current[key] ?? 0) + elapsed;
			activeMsRef.current[key] = next;
			if (next >= TOUCHED_MS) {
				setDirty((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
			}
		}, CLOCK_TICK_MS);
		return () => clearInterval(id);
	}, [ready, clockRunning]);

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
		/** The modes the student touched, as opposed to ones merely seeded. */
		dirty,
		setBpm,
		setQuality,
		setEffort,
		entries,
		blockingKey,
		selectMode,
	};
}
