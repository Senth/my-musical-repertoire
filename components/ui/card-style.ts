import type { TextStyle, ViewStyle } from "react-native";
import { type StateVisual, withAlpha } from "@/utils/state-colors";

/**
 * Card.Title defaults render title and subtitle in the same colour at the same
 * weight, which flattens the hierarchy — the piece title should dominate its
 * composer line. Pair `CARD_TITLE_STYLE` with a subtitle in `onSurfaceVariant`.
 */
export const CARD_TITLE_STYLE: TextStyle = {
	fontSize: 17,
	fontWeight: "500",
};

/**
 * `Card.Title` hard-codes a 72px container whether or not there is a subtitle,
 * and centres its text inside it. A piece card fills that with title+composer
 * and ends up with 11px below the text; a title-only card would leave 20px and
 * read as a gap. 50px brings a single title line back to 12px — centring
 * quantises in 2px steps, so 11px exactly is not reachable (48px gives 10px).
 */
export const TITLE_ONLY_CARD_STYLE: ViewStyle = {
	minHeight: 50,
};

/** The card's left accent stripe. Shelved/retired fade so they stay hindmost. */
export function accentBorderStyle(visual: StateVisual): ViewStyle {
	return {
		borderLeftWidth: 4,
		borderLeftColor: visual.outlined
			? withAlpha(visual.accent, 0.35)
			: visual.accent,
	};
}
