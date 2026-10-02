import { type ReactElement, type Ref, useState } from "react";
import { View } from "react-native";
import { Chip, TouchableRipple, useTheme } from "react-native-paper";
import { border, radius, space, touchTarget, type } from "@/theme/tokens";
import { type StateVisual, withAlpha } from "@/utils/state-colors";

interface StateChipProps {
	ref?: Ref<View>;
	label: string;
	visual: StateVisual;
	onPress?: () => void;
	expanded?: boolean;
}

/** Shared geometry for every informational chip, so none out-sizes its neighbour. */
const CHIP_TEXT_STYLE = {
	fontSize: type.labelSmall,
	lineHeight: type.labelSmallLineHeight,
	letterSpacing: 0.3,
	marginVertical: space.xxs,
	marginHorizontal: space.sm,
} as const;

/**
 * The lifecycle chip used for piece states, technique states and section states.
 *
 * Deliberately quiet: a low-alpha tint of the state's hue with hue-matched text,
 * so a list of cards reads title-first and the chips stay complementary. The
 * least-important states drop the fill entirely and get a hairline instead.
 */
export function StateChip({
	ref,
	label,
	visual,
	onPress,
	expanded,
}: StateChipProps): ReactElement {
	const theme = useTheme();
	const [focused, setFocused] = useState(false);

	const chip = (
		<Chip
			compact
			accessibilityRole="text"
			style={{
				backgroundColor: visual.outlined
					? "transparent"
					: withAlpha(visual.accent, visual.tint),
				borderColor: visual.outlined
					? theme.colors.outlineVariant
					: "transparent",
				borderWidth: visual.outlined ? 1 : 0,
				borderRadius: radius.chip,
				alignSelf: "flex-start",
			}}
			textStyle={{ ...CHIP_TEXT_STYLE, color: visual.accent }}
		>
			{label}
		</Chip>
	);

	if (!onPress) return chip;

	return (
		<TouchableRipple
			ref={ref}
			onPress={onPress}
			onFocus={() => setFocused(true)}
			onBlur={() => setFocused(false)}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ expanded }}
			aria-expanded={expanded}
			style={{
				minHeight: touchTarget.minimum,
				minWidth: touchTarget.minimum,
				alignSelf: "flex-start",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: radius.chip,
				outlineColor: theme.colors.primary,
				outlineStyle: "solid",
				outlineWidth: focused ? border.hairline : 0,
			}}
		>
			<View
				pointerEvents="none"
				accessible={false}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				{chip}
			</View>
		</TouchableRipple>
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
				borderRadius: radius.chip,
				alignSelf: "flex-start",
			}}
			textStyle={{ ...CHIP_TEXT_STYLE, color: theme.colors.onSurfaceVariant }}
		>
			{label}
		</Chip>
	);
}
