import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";

interface TechniqueLogComparisonProps {
	techniqueName: string;
	currentQuality: 1 | 2 | 3 | 4 | 5;
	currentEffort: 1 | 2 | 3 | 4 | 5;
	currentTempoBpm?: number | null;
	previousQuality?: 1 | 2 | 3 | 4 | 5 | null;
	previousEffort?: 1 | 2 | 3 | 4 | 5 | null;
	previousTempoBpm?: number | null;
	targetTempoBpm?: number | null;
	isCompact: boolean;
}

function QualityRow({
	label,
	current,
	previous,
}: {
	label: string;
	current: 1 | 2 | 3 | 4 | 5;
	previous?: 1 | 2 | 3 | 4 | 5 | null;
}) {
	const { t } = useTranslation();
	const theme = useTheme();

	const hasPrevious = previous != null;
	const diff = hasPrevious ? current - previous : 0;
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
					<Text variant="bodyLarge">
						{t(`technique.quality.${current}` as Parameters<typeof t>[0])}
					</Text>
					{hasPrevious && (
						<MaterialCommunityIcons
							name={iconName}
							size={20}
							color={iconColor}
						/>
					)}
				</View>
				{hasPrevious && (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.comparison.previous")}:{" "}
						{t(`technique.quality.${previous}` as Parameters<typeof t>[0])}
					</Text>
				)}
			</View>
		</View>
	);
}

function EffortRow({
	label,
	current,
	previous,
}: {
	label: string;
	current: 1 | 2 | 3 | 4 | 5;
	previous?: 1 | 2 | 3 | 4 | 5 | null;
}) {
	const { t } = useTranslation();
	const theme = useTheme();

	const hasPrevious = previous != null;

	return (
		<View className="gap-1">
			<Text variant="labelLarge">{label}</Text>
			<View className="flex-row items-center justify-between">
				<Text variant="bodyLarge">
					{t(`technique.effort.${current}` as Parameters<typeof t>[0])}
				</Text>
				{hasPrevious && (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practice.comparison.previous")}:{" "}
						{t(`technique.effort.${previous}` as Parameters<typeof t>[0])}
					</Text>
				)}
			</View>
		</View>
	);
}

function TempoRow({
	label,
	current,
	previous,
	target,
}: {
	label: string;
	current?: number | null;
	previous?: number | null;
	target?: number | null;
}) {
	const { t } = useTranslation();
	const theme = useTheme();

	const hasPrevious = previous != null;
	const diff = hasPrevious && current != null ? current - previous : 0;
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
					<Text variant="bodyLarge">
						{current != null ? `${current} BPM` : "—"}
					</Text>
					{hasPrevious && current != null && (
						<MaterialCommunityIcons
							name={iconName}
							size={20}
							color={iconColor}
						/>
					)}
				</View>
				<View className="items-end gap-1">
					{hasPrevious && (
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.practice.comparison.previous")}: {previous} BPM
						</Text>
					)}
					{target != null && (
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.practiceTechnique.comparison.tempoTarget", {
								bpm: target,
							})}
						</Text>
					)}
				</View>
			</View>
		</View>
	);
}

type Verdict = "firstPractice" | "improved" | "regressed" | "same";

function computeVerdict(
	currentQuality: number,
	previousQuality: number | null | undefined,
	currentEffort: number,
	previousEffort: number | null | undefined,
	currentTempo: number | null | undefined,
	previousTempo: number | null | undefined,
): Verdict {
	if (previousQuality == null) return "firstPractice";

	const qualityDelta = currentQuality - previousQuality;
	const tempoBonus =
		previousTempo != null &&
		currentTempo != null &&
		currentTempo > previousTempo
			? 1
			: 0;
	const effortPenalty =
		previousEffort != null && currentEffort > previousEffort ? 1 : 0;

	const score = qualityDelta * 2 + tempoBonus - effortPenalty;

	if (score > 0) return "improved";
	if (score < 0) return "regressed";
	return "same";
}

export function TechniqueLogComparison({
	techniqueName,
	currentQuality,
	currentEffort,
	currentTempoBpm,
	previousQuality,
	previousEffort,
	previousTempoBpm,
	targetTempoBpm,
	isCompact,
}: TechniqueLogComparisonProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();

	const verdict = computeVerdict(
		currentQuality,
		previousQuality,
		currentEffort,
		previousEffort,
		currentTempoBpm,
		previousTempoBpm,
	);

	const summaryKey = `screen.practiceTechnique.comparison.${verdict}`;
	const summaryColor =
		verdict === "improved"
			? theme.colors.tertiary
			: verdict === "regressed"
				? theme.colors.error
				: theme.colors.onSurface;

	return (
		<View
			className="gap-6"
			style={{ paddingHorizontal: isCompact ? 16 : 24, paddingTop: 24 }}
		>
			<View className="w-full max-w-xl self-center gap-6">
				<View className="gap-1">
					<Text variant="headlineSmall">
						{t("screen.practiceTechnique.comparison.title")}
					</Text>
					<Text
						variant="bodyLarge"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{techniqueName}
					</Text>
				</View>

				<Text variant="titleMedium" style={{ color: summaryColor }}>
					{t(summaryKey as Parameters<typeof t>[0])}
				</Text>

				<Divider />

				<QualityRow
					label={t("screen.practiceTechnique.comparison.qualityLabel")}
					current={currentQuality}
					previous={previousQuality}
				/>

				<EffortRow
					label={t("screen.practiceTechnique.comparison.effortLabel")}
					current={currentEffort}
					previous={previousEffort}
				/>

				{targetTempoBpm != null && (
					<TempoRow
						label={t("screen.practiceTechnique.comparison.tempoAchievedLabel")}
						current={currentTempoBpm}
						previous={previousTempoBpm}
						target={targetTempoBpm}
					/>
				)}

				<View className="mt-4">
					<Button
						mode="contained"
						onPress={() => router.replace("/(app)/(tabs)/technique")}
					>
						{t("screen.practiceTechnique.comparison.back")}
					</Button>
				</View>
			</View>
		</View>
	);
}
