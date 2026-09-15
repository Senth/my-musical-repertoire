import type { TFunction } from "i18next";
import type { ModeDraft } from "@/hooks/use-mode-drafts";
import type { PracticeDrill } from "@/models/practice";
import { practiceTally } from "./practice-tally";

/** Renders params inline so the expected strings read like the copy they stand for. */
const t = ((key: string, params?: Record<string, unknown>) => {
	if (!params) return key;
	return `${key}(${Object.values(params).join("|")})`;
}) as unknown as TFunction;

function draft(overrides: Partial<ModeDraft> = {}): ModeDraft {
	return { bpm: "", quality: null, effort: null, ...overrides };
}

/** The fake `t` renders a parameterless key verbatim — the tally joins on it. */
const SEP = "screen.practice.modes.summarySeparator";

function tally(
	drafts: Record<string, ModeDraft>,
	options: Partial<Parameters<typeof practiceTally>[0]> = {},
): string | null {
	return practiceTally({
		available: ["LH", "RH", "HT"],
		drills: [],
		dirty: new Set<string>(),
		t,
		...options,
		drafts,
	});
}

describe("practiceTally", () => {
	it("is blank when a seeded BPM was never touched", () => {
		expect(tally({ LH: draft({ bpm: "92" }), RH: draft({ bpm: "88" }) })).toBe(
			null,
		);
	});

	it("says in progress for a touched mode without ratings", () => {
		expect(
			tally(
				{ LH: draft({ bpm: "92" }), RH: draft() },
				{ dirty: new Set(["LH"]) },
			),
		).toBe(
			"screen.practice.meta.saving(screen.practice.meta.inProgress(screen.practice.modes.hands.LH))",
		);
	});

	it("lists every fully rated mode", () => {
		expect(
			tally({
				LH: draft({ bpm: "92", quality: 4, effort: 3 }),
				RH: draft({ bpm: "88", quality: 3, effort: 2 }),
				HT: draft(),
			}),
		).toBe(
			"screen.practice.meta.saving(" +
				"screen.practice.meta.saved(screen.practice.modes.hands.LH|92|technique.qualityShort.4)" +
				SEP +
				"screen.practice.meta.saved(screen.practice.modes.hands.RH|88|technique.qualityShort.3))",
		);
	});

	it("shows the best-rated draft of a hand and in progress for a touched one", () => {
		expect(
			tally(
				{
					LH: draft({ bpm: "92", quality: 4, effort: 3 }),
					"LH.staccato": draft({ bpm: "80", quality: 2, effort: 2 }),
					RH: draft(),
				},
				{ dirty: new Set(["RH"]) },
			),
		).toBe(
			"screen.practice.meta.saving(" +
				"screen.practice.meta.saved(screen.practice.modes.hands.LH|92|technique.qualityShort.4)" +
				SEP +
				"screen.practice.meta.inProgress(screen.practice.modes.hands.RH))",
		);
	});

	it("counts an active drill's draft but not a retired one", () => {
		const drafts = {
			"LH.staccato": draft({ bpm: "84", quality: 4, effort: 4 }),
		};
		expect(
			tally(drafts, { drills: ["staccato"] as PracticeDrill[] }),
		).toContain("screen.practice.modes.hands.LH");
		expect(tally(drafts)).toBeNull();
	});

	it("skips hands the item does not offer", () => {
		expect(
			tally(
				{ LH: draft({ bpm: "92", quality: 4, effort: 3 }), HT: draft() },
				{ available: ["HT"], dirty: new Set(["HT"]) },
			),
		).toBe(
			"screen.practice.meta.saving(screen.practice.meta.inProgress(screen.practice.modes.hands.HT))",
		);
	});
});
