import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Animated, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { space } from "@/theme/tokens";

const FADE_MS = 150;

/**
 * The muted meta line. It cross-fades when its text changes after first paint —
 * whoever changed it — and does not animate on mount, per the motion rule that
 * only state changing after page load animates.
 */
function CrossFadeText({ text }: { text: string }) {
	const theme = useTheme();
	const fade = useRef(new Animated.Value(1)).current;
	const [current, setCurrent] = useState(text);
	const [previous, setPrevious] = useState<string | null>(null);
	const painted = useRef(false);

	useEffect(() => {
		if (!painted.current) {
			painted.current = true;
			return;
		}
		if (text === current) return;
		setPrevious(current);
		setCurrent(text);
		fade.setValue(0);
		Animated.timing(fade, {
			toValue: 1,
			duration: FADE_MS,
			useNativeDriver: true,
		}).start(({ finished }) => {
			if (finished) setPrevious(null);
		});
	}, [text, current, fade]);

	return (
		<View style={{ flex: 1 }}>
			{previous != null && (
				<Animated.View
					style={{ position: "absolute", left: 0, right: 0 }}
					pointerEvents="none"
				>
					<Text
						variant="bodySmall"
						numberOfLines={1}
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{previous}
					</Text>
				</Animated.View>
			)}
			<Animated.View style={{ opacity: fade }}>
				<Text
					variant="bodySmall"
					numberOfLines={1}
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{current}
				</Text>
			</Animated.View>
		</View>
	);
}

interface PracticeMetaProps {
	/**
	 * What the save will contain. Left out on a screen with no hand modes — a
	 * whole piece — so its line keeps the row to itself with the chip.
	 */
	tally?: string | null;
	/** The last-practised line, or `null` while the history is still loading. */
	lastLine: string | null;
	/** Lifecycle chip at the row's right edge. */
	chip?: ReactNode;
}

/**
 * The two meta rows under the hand tabs: what this save will contain, then
 * when the passage was last touched. No box, no elevation — muted small-body
 * lines, with the lifecycle chip on the first row's right end.
 */
export function PracticeMeta({ tally, lastLine, chip }: PracticeMetaProps) {
	const showTallyRow = tally !== undefined && (!!tally || !!chip);
	const showLastRow = lastLine != null || (!!chip && !showTallyRow);
	if (!showTallyRow && !showLastRow) return null;

	const rowStyle = {
		flexDirection: "row" as const,
		alignItems: "center" as const,
		gap: space.sm,
	};

	return (
		<View style={{ gap: space.xs }}>
			{showTallyRow && (
				<View style={rowStyle}>
					<CrossFadeText text={tally ?? ""} />
					{chip}
				</View>
			)}
			{showLastRow && (
				<View style={rowStyle}>
					{lastLine != null ? (
						<CrossFadeText text={lastLine} />
					) : (
						<View style={{ flex: 1 }} />
					)}
					{!showTallyRow && chip}
				</View>
			)}
		</View>
	);
}
