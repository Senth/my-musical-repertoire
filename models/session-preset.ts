import type { SessionAllocation } from "@/models/session";

/**
 * A session preset is a named list of per-block-kind minutes. Absolute minutes,
 * never percentages: fixed costs (warmup, one technique item done properly)
 * barely shrink with total time, so a scaling template produces bloat at 75 min
 * and slivers at 20. A different total means a different preset.
 */
export type PresetLineKey =
	| "warmup"
	| "sightReading"
	| "technique"
	| "repertoireLearning"
	| "repertoireStabilizing"
	| "repertoireMaintenance";

/**
 * Canonical order for every preset: warmup → sight-reading → technique →
 * learning → stabilizing → maintenance. Reading sits directly after warmup —
 * it is demanding on the brain but light on the hands, so it extends the warmup
 * rather than competing with technique, and reading last only trains guessing.
 */
export const PRESET_LINE_KEYS: PresetLineKey[] = [
	"warmup",
	"sightReading",
	"technique",
	"repertoireLearning",
	"repertoireStabilizing",
	"repertoireMaintenance",
];

/** Minutes per line. `null`/absent = the line is switched off for this preset. */
export type PresetLines = Partial<Record<PresetLineKey, number | null>>;

export interface SessionPreset {
	id?: string;
	userId: string;
	name: string;
	order: number;
	lines: PresetLines;
	/** `true` for the single remembered Custom doc. Excluded from the list. */
	scratch?: boolean;
}

export interface PresetLineLimits {
	/** Slider minimum. Zero is not typeable — unchecking switches a line off. */
	floor: number;
	max: number;
	step: number;
}

/**
 * Per-line floors make slivers impossible by construction rather than dropped
 * at runtime: one 12-minute block beats three 4-minute blocks.
 */
export const PRESET_LINE_LIMITS: Record<PresetLineKey, PresetLineLimits> = {
	// Below 3 the hands are not warm.
	warmup: { floor: 3, max: 15, step: 1 },
	// Needs 2–3 short items; 3 min is one panicked run.
	sightReading: { floor: 5, max: 30, step: 1 },
	// One item: slow → correct → repeat.
	technique: { floor: 5, max: 45, step: 1 },
	// Full loop: slow, hands separate, correct, tempo step.
	repertoireLearning: { floor: 8, max: 60, step: 1 },
	repertoireStabilizing: { floor: 5, max: 45, step: 1 },
	// Quantized to whole run-throughs by the planner, so the floor is "one short
	// piece" rather than a fixed working span.
	repertoireMaintenance: { floor: 3, max: 60, step: 1 },
};

/** The Custom row's remembered values live in one fixed doc per user. */
export const SCRATCH_PRESET_ID = "custom";

/** Total is derived — the sum of enabled lines. There is no total slider. */
export function presetTotalMinutes(lines: PresetLines): number {
	let total = 0;
	for (const key of PRESET_LINE_KEYS) {
		const value = lines[key];
		if (value != null) total += value;
	}
	return total;
}

/** Resolves a preset into the allocation the planner consumes. */
export function allocationFromLines(lines: PresetLines): SessionAllocation {
	return {
		warmup: lines.warmup ?? 0,
		sightReading: lines.sightReading ?? 0,
		technique: lines.technique ?? 0,
		repertoireLearning: lines.repertoireLearning ?? 0,
		repertoireStabilizing: lines.repertoireStabilizing ?? 0,
		repertoireMaintenance: lines.repertoireMaintenance ?? 0,
	};
}

export function isLineEnabled(lines: PresetLines, key: PresetLineKey): boolean {
	return lines[key] != null;
}

/** Snap a line's minutes into its floor..max range. */
export function clampLineMinutes(key: PresetLineKey, value: number): number {
	const { floor, max } = PRESET_LINE_LIMITS[key];
	return Math.max(floor, Math.min(max, Math.round(value)));
}

export type DefaultPresetKey =
	| "balanced"
	| "reading-focused"
	| "technique-focused"
	| "repertoire-focused";

export interface DefaultPresetSeed {
	key: DefaultPresetKey;
	order: number;
	lines: PresetLines;
}

/**
 * All four seed at 30 minutes — a sane default session — and differ only in
 * shape, which is what "emphasis" ever meant.
 *
 * Two rules shaped these beyond the old reference rows:
 * - Reading never seeds below its 5-minute floor. Where the old row had a
 *   2-minute reading sliver the line is switched off outright — a preset named
 *   for technique is allowed to contain no reading.
 * - A preset that opens on reading needs no separate warmup line: reading is
 *   heavy on the brain and light on the hands, so it *is* the warmup. Presets
 *   that open on technique or repertoire meet cold hands and seed 3 minutes.
 */
export const DEFAULT_PRESET_SEEDS: DefaultPresetSeed[] = [
	{
		key: "balanced",
		order: 0,
		// The only seed touching every category, so a student who only ever runs
		// Balanced still keeps old repertoire from rotting.
		lines: {
			sightReading: 5,
			technique: 6,
			repertoireLearning: 11,
			repertoireStabilizing: 5,
			repertoireMaintenance: 3,
		},
	},
	{
		key: "reading-focused",
		order: 1,
		lines: {
			sightReading: 9,
			technique: 5,
			repertoireLearning: 10,
			repertoireStabilizing: 6,
		},
	},
	{
		key: "technique-focused",
		order: 2,
		lines: {
			warmup: 3,
			technique: 13,
			repertoireLearning: 8,
			repertoireStabilizing: 6,
		},
	},
	{
		key: "repertoire-focused",
		order: 3,
		lines: {
			warmup: 3,
			repertoireLearning: 12,
			repertoireStabilizing: 8,
			repertoireMaintenance: 7,
		},
	},
];

/**
 * Built-ins missing from the user's presets, matched by localized name.
 * Restoring re-adds only these — existing presets are never touched.
 */
export function missingDefaultSeeds(
	existingNames: string[],
	nameFor: (key: DefaultPresetKey) => string,
): DefaultPresetSeed[] {
	const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));
	return DEFAULT_PRESET_SEEDS.filter(
		(seed) => !taken.has(nameFor(seed.key).trim().toLowerCase()),
	);
}
