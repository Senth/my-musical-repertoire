import type { TFunction } from "i18next";
import { type ModeDraft, parseBpm } from "@/hooks/use-mode-drafts";
import type { HandsMode, ModeKey, PracticeDrill } from "@/models/practice";
import { HANDS_MODES } from "@/models/practice";
import { parseModeKey } from "@/utils/practice-modes";

interface PracticeTallyArgs {
	/** One draft per mode key, as held by `useModeDrafts`. */
	drafts: Record<ModeKey, ModeDraft>;
	available: HandsMode[];
	/** The active drills, so a retired drill's draft never reaches the tally. */
	drills: PracticeDrill[];
	/**
	 * The modes the student actually touched. A seeded BPM without a touch
	 * contributes nothing — the row stays blank rather than saying "in progress".
	 */
	dirty: ReadonlySet<ModeKey>;
	t: TFunction;
}

/**
 * What the save will contain, as one muted line: the tally is grouped by hands
 * mode — the best-rated draft of each hand, or "in progress" once that hand
 * was touched but is not fully rated yet.
 */
export function practiceTally({
	drafts,
	available,
	drills,
	dirty,
	t,
}: PracticeTallyArgs): string | null {
	const parts: string[] = [];
	for (const h of HANDS_MODES) {
		if (!available.includes(h)) continue;
		const keys = Object.keys(drafts).filter((key) => {
			const parsed = parseModeKey(key);
			return (
				parsed.hands === h &&
				(parsed.drill === null || drills.includes(parsed.drill))
			);
		});
		const complete = keys
			.map((key) => drafts[key])
			.find((d) => d.quality != null && d.effort != null);
		if (complete) {
			parts.push(
				t("screen.practice.meta.saved", {
					mode: t(`screen.practice.modes.hands.${h}`),
					bpm: parseBpm(complete.bpm) ?? "—",
					quality: t(
						`technique.qualityShort.${complete.quality}` as Parameters<
							typeof t
						>[0],
					),
				}),
			);
		} else if (keys.some((key) => dirty.has(key))) {
			parts.push(
				t("screen.practice.meta.inProgress", {
					mode: t(`screen.practice.modes.hands.${h}`),
				}),
			);
		}
	}
	if (parts.length === 0) return null;
	return t("screen.practice.meta.saving", {
		tally: parts.join(t("screen.practice.modes.summarySeparator")),
	});
}
