import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ProgressBar, Text, useTheme } from "react-native-paper";
import { PracticeMistakes } from "@/models/practice";

interface PieceProgressBarProps {
	technicalMistakes?: PracticeMistakes;
	memoryMistakes?: PracticeMistakes;
	showLabel?: boolean;
}

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
		<View className="flex-row items-center gap-2">
			<View className="flex-1">
				<ProgressBar
					progress={score !== null ? score / 10 : 0}
					color={theme.colors.primary}
					style={{ height: 6, borderRadius: 3 }}
				/>
			</View>
			{showLabel && (
				<Text
					variant="labelSmall"
					style={{ color: theme.colors.onSurfaceVariant, minWidth: 32 }}
				>
					{score !== null
						? t("common.score", { score: Math.round(score) })
						: "–"}
				</Text>
			)}
		</View>
	);
}
