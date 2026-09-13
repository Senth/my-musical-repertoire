import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "react-native";
import { useIsCompact } from "@/hooks/use-is-compact";
import { contentWidth, space } from "@/theme/tokens";

const GAP = {
	0: undefined,
	1: space.xs,
	2: space.sm,
	3: space.md,
	4: space.lg,
	6: space.xl,
} as const;

interface ScreenContentProps {
	children: ReactNode;
	/** Vertical gap between direct children of the centered band. */
	gap?: keyof typeof GAP;
	paddingTop?: number;
	paddingBottom?: number;
	/** Wrap in a ScrollView. Set false when an ancestor already scrolls. */
	scroll?: boolean;
	/** Passthrough style for the outer ScrollView (e.g. `{ flex: 1 }`). */
	style?: StyleProp<ViewStyle>;
}

/**
 * Shared layout for centered page content: applies the responsive horizontal
 * page padding (`isCompact ? 16 : 24`) and constrains content to a centered
 * `max-w-xl` band. The horizontal padding is intentionally not configurable —
 * it is the invariant every screen must share so the metronome (and everything
 * else) keeps a consistent width across pages.
 */
export function ScreenContent({
	children,
	gap = 6,
	paddingTop = 24,
	paddingBottom = 0,
	scroll = true,
	style,
}: ScreenContentProps) {
	const isCompact = useIsCompact();
	const body = (
		<View
			style={{
				paddingHorizontal: isCompact ? 16 : 24,
				paddingTop,
				paddingBottom,
			}}
		>
			<View
				style={{
					width: "100%",
					maxWidth: contentWidth.page,
					alignSelf: "center",
					gap: GAP[gap],
				}}
			>
				{children}
			</View>
		</View>
	);
	return scroll ? <ScrollView style={style}>{body}</ScrollView> : body;
}
