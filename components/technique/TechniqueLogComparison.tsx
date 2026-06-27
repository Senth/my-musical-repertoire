import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { TrendIcon } from "@/components/ui/TrendIcon";

interface TechniqueLogComparisonProps {
	techniqueName: string;
	currentQuality: 1 | 2 | 3 | 4 | 5;
	currentEffort: 1 | 2 | 3 | 4 | 5;
	currentTempoBpm?: number | null;
	previousQuality?: 1 | 2 | 3 | 4 | 5 | null;
	previousEffort?: 1 | 2 | 3 | 4 | 5 | null;
	previousTempoBpm?: number | null;
	targetTempoBpm?: number | null;
	onDone: () => void;
	backLabel: string;
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

	return (
		<View className="gap-1">
			<Text variant="labelLarge">{label}</Text>
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Text variant="bodyLarge">
						{t(`technique.quality.${current}` as Parameters<typeof t>[0])}
					</Text>
					<TrendIcon diff={diff} visible={hasPrevious} />
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

	return (
		<View className="gap-1">
			<Text variant="labelLarge">{label}</Text>
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Text variant="bodyLarge">
						{current != null ? `${current} BPM` : "—"}
					</Text>
					<TrendIcon diff={diff} visible={hasPrevious && current != null} />
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
	onDone,
	backLabel,
}: TechniqueLogComparisonProps) {
	const { t } = useTranslation();
	const theme = useTheme();

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
		<ScreenContent scroll={false}>
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
				<Button mode="contained" onPress={onDone}>
					{backLabel}
				</Button>
			</View>
		</ScreenContent>
	);
}
