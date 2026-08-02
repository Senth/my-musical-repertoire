import type { TFunction } from "i18next";
import type { EstimationOption } from "@/components/practice/EstimationField";
import { PracticeMistakes } from "@/models/practice";

export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * Every self-estimation runs worst → best, left → right. That means quality
 * counts up (1 fell apart … 5 clean) while effort and mistakes count *down*,
 * since low effort and no mistakes are the good outcomes. Only the render order
 * changes — the stored values are untouched.
 */
const QUALITY_ORDER: Rating[] = [1, 2, 3, 4, 5];
const EFFORT_ORDER: Rating[] = [5, 4, 3, 2, 1];

const MISTAKE_ORDER: PracticeMistakes[] = [
	PracticeMistakes.everywhere,
	PracticeMistakes.many,
	PracticeMistakes.some,
	PracticeMistakes.few,
	PracticeMistakes.none,
];

const MISTAKE_KEYS: Record<PracticeMistakes, string> = {
	[PracticeMistakes.none]: "none",
	[PracticeMistakes.few]: "few",
	[PracticeMistakes.some]: "some",
	[PracticeMistakes.many]: "many",
	[PracticeMistakes.everywhere]: "everywhere",
};

export function qualityOptions(t: TFunction): EstimationOption<Rating>[] {
	return QUALITY_ORDER.map((value) => ({
		value,
		short: t(`technique.qualityShort.${value}` as Parameters<TFunction>[0]),
		full: t(`technique.quality.${value}` as Parameters<TFunction>[0]),
	}));
}

export function effortOptions(t: TFunction): EstimationOption<Rating>[] {
	return EFFORT_ORDER.map((value) => ({
		value,
		short: t(`technique.effortShort.${value}` as Parameters<TFunction>[0]),
		full: t(`technique.effort.${value}` as Parameters<TFunction>[0]),
	}));
}

export function mistakeOptions(
	t: TFunction,
): EstimationOption<PracticeMistakes>[] {
	return MISTAKE_ORDER.map((value) => ({
		value,
		short: t(
			`screen.practice.mistakeLevelShort.${MISTAKE_KEYS[value]}` as Parameters<TFunction>[0],
		),
		full: t(
			`screen.practice.mistakeLevel.${MISTAKE_KEYS[value]}` as Parameters<TFunction>[0],
		),
	}));
}
