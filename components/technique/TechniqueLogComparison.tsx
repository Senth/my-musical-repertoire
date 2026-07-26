import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Divider, Text, useTheme } from "react-native-paper";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { TrendIcon } from "@/components/ui/TrendIcon";
import type { ModeKey } from "@/models/practice";
import { modeLabelLong } from "@/utils/mode-label";

/** One saved mode, with the values its own previous log had. */
export interface ModeComparison {
	modeKey: ModeKey;
	currentQuality: 1 | 2 | 3 | 4 | 5;
	currentEffort: 1 | 2 | 3 | 4 | 5;
	currentTempoBpm?: number | null;
	previousQuality?: 1 | 2 | 3 | 4 | 5 | null;
	previousEffort?: 1 | 2 | 3 | 4 | 5 | null;
	previousTempoBpm?: number | null;
	targetTempoBpm?: number | null;
}

interface TechniqueLogComparisonProps {
	techniqueName: string;
	/** One block is rendered per entry; a single entry looks unchanged. */
	modes: ModeComparison[];
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

/** Positive = better than last time. `null` when there is nothing to compare. */
function modeScore(mode: ModeComparison): number | null {
	if (mode.previousQuality == null) return null;

	const qualityDelta = mode.currentQuality - mode.previousQuality;
	const tempoBonus =
		mode.previousTempoBpm != null &&
		mode.currentTempoBpm != null &&
		mode.currentTempoBpm > mode.previousTempoBpm
			? 1
			: 0;
	const effortPenalty =
		mode.previousEffort != null && mode.currentEffort > mode.previousEffort
			? 1
			: 0;

	return qualityDelta * 2 + tempoBonus - effortPenalty;
}

/** Across every saved mode: first practice unless at least one has a history. */
function computeVerdict(modes: ModeComparison[]): Verdict {
	const scores = modes.map(modeScore).filter((s): s is number => s !== null);
	if (scores.length === 0) return "firstPractice";

	const total = scores.reduce((sum, s) => sum + s, 0);
	if (total > 0) return "improved";
	if (total < 0) return "regressed";
	return "same";
}

export function TechniqueLogComparison({
	techniqueName,
	modes,
	onDone,
	backLabel,
}: TechniqueLogComparisonProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const verdict = computeVerdict(modes);
	const showModeHeadings = modes.length > 1;

	const summaryKey = `screen.practiceTechnique.comparison.${verdict}`;
	const summaryColor =
		verdict === "improved"
			? theme.colors.tertiary
			: verdict === "regressed"
				? theme.colors.error
				: theme.colors.onSurface;

	return (
		<ScreenContent scroll={showModeHeadings}>
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
				{showModeHeadings && (
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.practiceTechnique.comparison.savedModes", {
							count: modes.length,
						})}
					</Text>
				)}
			</View>

			<Text variant="titleMedium" style={{ color: summaryColor }}>
				{t(summaryKey as Parameters<typeof t>[0])}
			</Text>

			<Divider />

			{modes.map((mode) => (
				<View key={mode.modeKey} className="gap-3">
					{showModeHeadings && (
						<Text variant="titleSmall">{modeLabelLong(mode.modeKey, t)}</Text>
					)}

					<QualityRow
						label={t("screen.practiceTechnique.comparison.qualityLabel")}
						current={mode.currentQuality}
						previous={mode.previousQuality}
					/>

					<EffortRow
						label={t("screen.practiceTechnique.comparison.effortLabel")}
						current={mode.currentEffort}
						previous={mode.previousEffort}
					/>

					{mode.targetTempoBpm != null && (
						<TempoRow
							label={t(
								"screen.practiceTechnique.comparison.tempoAchievedLabel",
							)}
							current={mode.currentTempoBpm}
							previous={mode.previousTempoBpm}
							target={mode.targetTempoBpm}
						/>
					)}
				</View>
			))}

			<View className="mt-4">
				<Button mode="contained" onPress={onDone}>
					{backLabel}
				</Button>
			</View>
		</ScreenContent>
	);
}
