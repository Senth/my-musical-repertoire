import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";
import { PracticeMistakes } from "@/models/practice";
import { radius, size, space } from "@/theme/tokens";

interface PieceProgressBarProps {
	technicalMistakes?: PracticeMistakes;
	memoryMistakes?: PracticeMistakes;
	showLabel?: boolean;
}

/** Column under the score label, so the bar's width stops jumping between
 * "9.9", "–" and nothing. */
const SCORE_LABEL_WIDTH = 32;

export function calculateScore(
	technicalMistakes?: PracticeMistakes,
	memoryMistakes?: PracticeMistakes,
): number | null {
	if (technicalMistakes === undefined && memoryMistakes === undefined) {
		return null;
	}
	const tech = technicalMistakes ?? PracticeMistakes.none;
	const mem = memoryMistakes ?? PracticeMistakes.none;
	return (4 - tech + (4 - mem)) * 1.25;
}

export function PieceProgressBar({
	technicalMistakes,
	memoryMistakes,
	showLabel = true,
}: PieceProgressBarProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const score = calculateScore(technicalMistakes, memoryMistakes);

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: space.sm,
			}}
		>
			<View style={{ flex: 1, minHeight: 0 }}>
				<ProgressBar
					progress={score !== null ? score / 10 : 0}
					color={theme.colors.primary}
					style={{ height: size.track, borderRadius: radius.hairline }}
				/>
			</View>
			{showLabel && (
				<Text
					variant="labelSmall"
					style={{
						color: theme.colors.onSurfaceVariant,
						minWidth: SCORE_LABEL_WIDTH,
					}}
				>
					{score !== null
						? t("common.score", { score: Math.round(score) })
						: "–"}
				</Text>
			)}
		</View>
	);
}
