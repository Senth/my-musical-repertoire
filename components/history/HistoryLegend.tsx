import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { HISTORY_METRICS } from "@/components/history/ScoreMeter";
import { icon, space } from "@/theme/tokens";

export function HistoryLegend({ kind }: { kind: "piece" | "technique" }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const metrics =
		kind === "piece"
			? (["quality", "effort", "technical", "memory"] as const)
			: (["quality", "effort"] as const);
	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
			{metrics.map((metric) => (
				<View
					key={metric}
					style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
				>
					<Icon
						source={HISTORY_METRICS[metric]}
						size={icon.sm}
						color={theme.colors.onSurfaceVariant}
					/>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t(`screen.history.metrics.${metric}`)}
					</Text>
				</View>
			))}
		</View>
	);
}
