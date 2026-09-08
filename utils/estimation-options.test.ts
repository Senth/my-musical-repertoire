import type { TFunction } from "i18next";
import { PracticeMistakes } from "@/models/practice";
import {
	effortOptions,
	mistakeOptions,
	qualityOptions,
} from "./estimation-options";

const t = ((key: string) => key) as unknown as TFunction;

describe("qualityOptions", () => {
	it("runs worst to best", () => {
		expect(qualityOptions(t).map((o) => o.value)).toEqual([1, 2, 3, 4, 5]);
	});

	it("builds keys from the value", () => {
		expect(qualityOptions(t)[2]).toEqual({
			value: 3,
			short: "technique.qualityShort.3",
			full: "technique.quality.3",
		});
	});
});

describe("effortOptions", () => {
	it("runs worst to best, counting down", () => {
		expect(effortOptions(t).map((o) => o.value)).toEqual([5, 4, 3, 2, 1]);
	});

	it("builds keys from the value", () => {
		expect(effortOptions(t)[0]).toEqual({
			value: 5,
			short: "technique.effortShort.5",
			full: "technique.effort.5",
		});
	});
});

describe("mistakeOptions", () => {
	it("runs worst to best", () => {
		expect(mistakeOptions(t).map((o) => o.value)).toEqual([
			PracticeMistakes.everywhere,
			PracticeMistakes.many,
			PracticeMistakes.some,
			PracticeMistakes.few,
			PracticeMistakes.none,
		]);
	});

	it("builds keys from the enum name", () => {
		expect(mistakeOptions(t)[4]).toEqual({
			value: PracticeMistakes.none,
			short: "screen.practice.mistakeLevelShort.none",
			full: "screen.practice.mistakeLevel.none",
		});
	});
});
