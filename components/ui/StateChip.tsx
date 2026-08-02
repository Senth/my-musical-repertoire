import type { ReactElement } from "react";
import { Chip, useTheme } from "react-native-paper";
import { type StateVisual, withAlpha } from "@/utils/state-colors";

interface StateChipProps {
	label: string;
	visual: StateVisual;
	onPress?: () => void;
}

/** Shared geometry for every informational chip, so none out-sizes its neighbour. */
const CHIP_TEXT_STYLE = {
	fontSize: 11,
	lineHeight: 16,
	letterSpacing: 0.3,
	marginVertical: 3,
	marginHorizontal: 9,
} as const;

/**
 * The lifecycle chip used for piece states, technique states and section phases.
 *
 * Deliberately quiet: a low-alpha tint of the state's hue with hue-matched text,
 * so a list of cards reads title-first and the chips stay complementary. The
 * least-important states drop the fill entirely and get a hairline instead.
 */
export function StateChip({
	label,
	visual,
	onPress,
}: StateChipProps): ReactElement {
	const theme = useTheme();

	return (
		<Chip
			compact
			style={{
				backgroundColor: visual.outlined
					? "transparent"
					: withAlpha(visual.accent, visual.tint),
				borderColor: visual.outlined
					? theme.colors.outlineVariant
					: "transparent",
				borderWidth: visual.outlined ? 1 : 0,
				borderRadius: 6,
				alignSelf: "flex-start",
			}}
			textStyle={{ ...CHIP_TEXT_STYLE, color: visual.accent }}
			onPress={onPress}
		>
			{label}
		</Chip>
	);
}

/**
 * A neutral tag that carries no lifecycle meaning — a technique's type, say.
 * Shares `StateChip`'s geometry so the two never look like different components
 * sitting side by side, but stays colourless so state chips keep the colour.
 */
export function MetaChip({ label }: { label: string }): ReactElement {
	const theme = useTheme();

	return (
		<Chip
			compact
			style={{
				backgroundColor: withAlpha(
					theme.colors.onSurfaceVariant,
					theme.dark ? 0.11 : 0.07,
				),
				borderRadius: 6,
				alignSelf: "flex-start",
			}}
			textStyle={{ ...CHIP_TEXT_STYLE, color: theme.colors.onSurfaceVariant }}
		>
			{label}
		</Chip>
	);
}
