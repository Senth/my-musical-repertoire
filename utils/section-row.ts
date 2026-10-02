import type { TFunction } from "i18next";
import type { Section } from "@/models/section";
import { formatDaysAgo } from "@/utils/date";
import { formatBarRange } from "@/utils/piece-display";
import { deriveCurrentBpm } from "@/utils/practice-modes";

export function sectionRowFacts(
	section: Pick<
		Section,
		"startBar" | "endBar" | "targetBpmOverride" | "byMode" | "lastPracticed"
	>,
	pieceTargetBpm: number | null | undefined,
	t: TFunction,
	now?: Date,
) {
	const currentBpm = deriveCurrentBpm(section.byMode);
	const targetBpm = section.targetBpmOverride ?? pieceTargetBpm ?? null;
	const rawRatio =
		currentBpm != null && targetBpm != null ? currentBpm / targetBpm : null;
	const progress =
		rawRatio == null
			? null
			: {
					ratio: Math.min(1, Math.sqrt(rawRatio)),
					tone:
						rawRatio < 0.7 ? "error" : rawRatio < 0.9 ? "warning" : "success",
				};

	return {
		bars: formatBarRange(section, t),
		tempo:
			currentBpm == null
				? null
				: targetBpm == null
					? t("screen.pieceSections.bpm", { bpm: currentBpm })
					: t("section.tempoOfTarget", {
							current: currentBpm,
							target: targetBpm,
						}),
		lastPracticed:
			section.lastPracticed == null
				? null
				: formatDaysAgo(section.lastPracticed, t, now),
		progress,
	};
}
