import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
	IconButton,
	type MD3Theme,
	ProgressBar,
	Text,
	useTheme,
} from "react-native-paper";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import type { Section, SectionPhase } from "@/models/section";
import { formatDaysAgo } from "@/utils/date";
import { formatBarRange } from "@/utils/piece-display";
import { deriveCurrentBpm } from "@/utils/practice-modes";

type AppTheme = MD3Theme & {
	colors: MD3Theme["colors"] & {
		warning: string;
		success: string;
	};
};

interface SectionDetailRowProps {
	section: Section;
	pieceTargetBpm?: number | null;
	onPress: () => void;
	onPracticePress: () => void;
	onChangePhase?: (phase: SectionPhase) => void;
}

const NOTES_MAX = 40;

export function SectionDetailRow({
	section,
	pieceTargetBpm,
	onPress,
	onPracticePress,
	onChangePhase,
}: SectionDetailRowProps) {
	const { t } = useTranslation();
	const theme = useTheme<AppTheme>();

	const effectiveTargetBpm =
		section.targetBpmOverride ?? pieceTargetBpm ?? null;

	// Slowest hands mode — the section is only as fast as its weakest hand.
	const currentBpm = deriveCurrentBpm(section.byMode);

	const showProgress = currentBpm != null && effectiveTargetBpm != null;
	const rawRatio = showProgress
		? (currentBpm as number) / (effectiveTargetBpm as number)
		: 0;
	const fillRatio = showProgress ? Math.min(1, Math.sqrt(rawRatio)) : 0;
	const progressColor =
		rawRatio < 0.7
			? theme.colors.error
			: rawRatio < 0.9
				? theme.colors.warning
				: theme.colors.success;

	const barRangeText = formatBarRange(section, t);

	const bpmText = (() => {
		if (currentBpm == null) return null;
		if (effectiveTargetBpm != null) {
			return `${currentBpm} / ${effectiveTargetBpm} BPM`;
		}
		return t("screen.pieceSections.bpm", { bpm: currentBpm });
	})();

	const stalenessText =
		section.lastPracticed != null
			? formatDaysAgo(section.lastPracticed, t)
			: null;

	const notesText = (() => {
		if (!section.notes) return null;
		return section.notes.length > NOTES_MAX
			? `${section.notes.slice(0, NOTES_MAX)}…`
			: section.notes;
	})();

	const metaInline = [bpmText, stalenessText].filter(Boolean).join(" · ");

	return (
		<View style={{ backgroundColor: theme.colors.surface }}>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					paddingRight: 8,
				}}
			>
				<Pressable
					onPress={onPress}
					accessibilityLabel={section.label}
					style={({ pressed }) => ({
						flex: 1,
						opacity: pressed ? 0.7 : 1,
					})}
				>
					<View className="py-3 px-4 gap-1">
						<View className="flex-row items-center gap-2 flex-wrap">
							<Text variant="bodyLarge">{section.label}</Text>
							{barRangeText != null && (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{barRangeText}
								</Text>
							)}
						</View>
						<View className="flex-row items-center gap-2 flex-wrap">
							<SectionPhaseChip
								phase={section.phase}
								onChangePhase={onChangePhase}
							/>
							{metaInline.length > 0 && (
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{metaInline}
								</Text>
							)}
						</View>
						{notesText != null && (
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{notesText}
							</Text>
						)}
					</View>
				</Pressable>
				<IconButton
					icon="play"
					mode="contained-tonal"
					size={20}
					onPress={onPracticePress}
					accessibilityLabel={t("section.practiceLabel")}
					style={{ margin: 0 }}
				/>
			</View>
			{showProgress && (
				<ProgressBar
					progress={fillRatio}
					color={progressColor}
					style={{ height: 4 }}
				/>
			)}
		</View>
	);
}
