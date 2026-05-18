import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import {
	calculateScore,
	PieceProgressBar,
} from "@/components/ui/PieceProgressBar";
import { PracticeMistakes } from "@/models/practice";

const MISTAKE_LABELS: Record<PracticeMistakes, string> = {
	[PracticeMistakes.none]: "screen.practice.mistakeLevel.none",
	[PracticeMistakes.few]: "screen.practice.mistakeLevel.few",
	[PracticeMistakes.some]: "screen.practice.mistakeLevel.some",
	[PracticeMistakes.many]: "screen.practice.mistakeLevel.many",
	[PracticeMistakes.everywhere]: "screen.practice.mistakeLevel.everywhere",
};

interface PracticeComparisonProps {
	pieceName: string;
	currentTechnical: PracticeMistakes;
	currentMemory: PracticeMistakes;
	previousTechnical?: PracticeMistakes;
	previousMemory?: PracticeMistakes;
	isCompact: boolean;
	onDone: () => void;
	backLabel: string;
}

function ComparisonRow({
	label,
	current,
	previous,
}: {
	label: string;
	current: PracticeMistakes;
	previous?: PracticeMistakes;
}) {
	const { t } = useTranslation();
	const theme = useTheme();

	const hasComparison = previous !== undefined;
	// Lower mistakes = improvement
	const diff = hasComparison ? previous - current : 0;
	const improved = diff > 0;
	const regressed = diff < 0;

	const iconName = improved ? "arrow-up" : regressed ? "arrow-down" : "minus";
	const iconColor = improved
		? theme.colors.tertiary
		: regressed
			? theme.colors.error
			: theme.colors.onSurfaceVariant;

	return (
		<View className="gap-1">
			<Text variant="labelLarge">{label}</Text>
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Text variant="bodyLarge">{t(MISTAKE_LABELS[current])}</Text>
					{hasComparison && (
						<MaterialCommunityIcons
							name={iconName}
							size={20}
							color={iconColor}
						/>
					)}
				</View>
				{hasComparison && (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.comparison.previous")}:{" "}
						{t(MISTAKE_LABELS[previous])}
					</Text>
				)}
			</View>
		</View>
	);
}

export function PracticeComparison({
	pieceName,
	currentTechnical,
	currentMemory,
	previousTechnical,
	previousMemory,
	isCompact,
	onDone,
	backLabel,
}: PracticeComparisonProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const hasPrevious =
		previousTechnical !== undefined || previousMemory !== undefined;

	const currentScore = calculateScore(currentTechnical, currentMemory);
	const previousScore = hasPrevious
		? calculateScore(previousTechnical, previousMemory)
		: null;

	const scoreDiff =
		currentScore !== null && previousScore !== null
			? currentScore - previousScore
			: null;

	let summaryKey: string;
	if (!hasPrevious) {
		summaryKey = "screen.practice.comparison.firstPractice";
	} else if (scoreDiff !== null && scoreDiff > 0) {
		summaryKey = "screen.practice.comparison.improved";
	} else if (scoreDiff !== null && scoreDiff < 0) {
		summaryKey = "screen.practice.comparison.regressed";
	} else {
		summaryKey = "screen.practice.comparison.same";
	}

	return (
		<View
			className="gap-6"
			style={{ paddingHorizontal: isCompact ? 16 : 24, paddingTop: 24 }}
		>
			<View className="w-full max-w-xl self-center gap-6">
				<View className="gap-1">
					<Text variant="headlineSmall">
						{t("screen.practice.comparison.title")}
					</Text>
					<Text
						variant="bodyLarge"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{pieceName}
					</Text>
				</View>

				<Text
					variant="titleMedium"
					style={{
						color:
							scoreDiff !== null && scoreDiff > 0
								? theme.colors.tertiary
								: scoreDiff !== null && scoreDiff < 0
									? theme.colors.error
									: theme.colors.onSurface,
					}}
				>
					{t(summaryKey)}
				</Text>

				<View className="gap-2">
					<Text
						variant="labelMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("common.score", { score: Math.round(currentScore ?? 0) })}
						{previousScore !== null &&
							` (${t("screen.practice.comparison.previous")}: ${t("common.score", { score: Math.round(previousScore) })})`}
					</Text>
					<PieceProgressBar
						technicalMistakes={currentTechnical}
						memoryMistakes={currentMemory}
						showLabel={false}
					/>
				</View>

				<Divider />

				<ComparisonRow
					label={t("screen.practice.technicalMistakes")}
					current={currentTechnical}
					previous={previousTechnical}
				/>

				<ComparisonRow
					label={t("screen.practice.memoryMistakes")}
					current={currentMemory}
					previous={previousMemory}
				/>

				<View className="mt-4">
					<Button mode="contained" onPress={onDone}>
						{backLabel}
					</Button>
				</View>
			</View>
		</View>
	);
}
