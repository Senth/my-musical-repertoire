import type { TFunction } from "i18next";
import type { Section } from "@/models/section";

/**
 * Composer line for read-only piece displays: `Composer · Collection`, falling
 * back to the composer alone when no collection is set.
 */
export function formatComposerLine(
	composer: string,
	collectionName?: string | null,
): string {
	const collection = collectionName?.trim();
	return collection ? `${composer} · ${collection}` : composer;
}

/**
 * Bar-range text for a section: `Bars 33–40`, falling back to `From bar 33`
 * when only the start is set, and `null` when the section has no start bar.
 */
export function formatBarRange(
	section: Pick<Section, "startBar" | "endBar">,
	t: TFunction,
): string | null {
	if (section.startBar == null) return null;
	if (section.endBar != null) {
		return t("screen.pieceSections.barRange", {
			start: section.startBar,
			end: section.endBar,
		});
	}
	return t("screen.pieceSections.barFrom", { start: section.startBar });
}
