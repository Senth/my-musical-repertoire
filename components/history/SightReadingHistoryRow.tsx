import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { BpmValue } from "@/components/history/BpmValue";
import { ScoreBar } from "@/components/history/ScoreMeter";
import type { SightReadingLog } from "@/models/sight-reading";
import { icon, space } from "@/theme/tokens";
import { keptGoingOptions } from "@/utils/estimation-options";
import { displayMinutes, minutesLabelKey } from "@/utils/format-minutes";

export function SightReadingHistoryRow({ entry }: { entry: SightReadingLog }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const minutes = displayMinutes(entry.elapsedSeconds / 60);
	const rating = keptGoingOptions(t).find(
		(option) => option.value === entry.keptGoing,
	);
	return (
		<View style={{ paddingVertical: space.md, gap: space.xs }}>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "baseline",
					gap: space.sm,
				}}
			>
				<Text variant="bodyLarge">
					{t(minutesLabelKey(minutes.approx), { minutes: minutes.minutes })}
				</Text>
				<BpmValue value={entry.achievedBpm} />
			</View>
			<View
				style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
			>
				{rating && (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: space.xs,
						}}
					>
						<Icon
							source="page-next-outline"
							size={icon.sm}
							color={theme.colors.onSurfaceVariant}
						/>
						<ScoreBar steps={rating.value} />
					</View>
				)}
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant, flexShrink: 1 }}
				>
					{rating?.full ?? t("screen.history.notRated")}
				</Text>
			</View>
		</View>
	);
}
