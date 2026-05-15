import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	ProgressBar,
	Text,
	TouchableRipple,
	useTheme,
} from "react-native-paper";
import { SectionPhaseChip } from "@/components/section/SectionPhaseChip";
import type { Section } from "@/models/section";

interface SectionDetailRowProps {
	section: Section;
	pieceTargetBpm?: number | null;
	onPress: () => void;
}

export function SectionDetailRow({
	section,
	pieceTargetBpm,
	onPress,
}: SectionDetailRowProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const effectiveTargetBpm =
		section.targetBpmOverride ?? pieceTargetBpm ?? null;
	const bpmProgress =
		section.currentBpm != null && effectiveTargetBpm != null
			? Math.min(1, section.currentBpm / effectiveTargetBpm)
			: null;

	const barRangeText = (() => {
		if (section.startBar != null && section.endBar != null) {
			return t("screen.pieceSections.barRange", {
				start: section.startBar,
				end: section.endBar,
			});
		}
		if (section.startBar != null) {
			return t("screen.pieceSections.barFrom", { start: section.startBar });
		}
		return null;
	})();

	const bpmText =
		section.currentBpm != null
			? effectiveTargetBpm != null
				? `${section.currentBpm} / ${effectiveTargetBpm} BPM`
				: t("screen.pieceSections.bpm", { bpm: section.currentBpm })
			: null;

	return (
		<TouchableRipple onPress={onPress}>
			<View style={{ backgroundColor: theme.colors.surface }}>
				{bpmProgress != null && (
					<ProgressBar
						progress={bpmProgress}
						color={theme.colors.primary}
						style={{ height: 3 }}
					/>
				)}
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
						<SectionPhaseChip phase={section.phase} />
						{bpmText != null && (
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{bpmText}
							</Text>
						)}
					</View>
				</View>
			</View>
		</TouchableRipple>
	);
}
