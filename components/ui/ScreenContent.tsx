import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "react-native";
import { useIsCompact } from "@/hooks/use-is-compact";

// NativeWind needs static class strings — map, don't template-interpolate.
const GAP = {
	0: "",
	1: "gap-1",
	2: "gap-2",
	3: "gap-3",
	4: "gap-4",
	6: "gap-6",
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
			<View className={`w-full max-w-xl self-center ${GAP[gap]}`}>
				{children}
			</View>
		</View>
	);
	return scroll ? <ScrollView style={style}>{body}</ScrollView> : body;
}
