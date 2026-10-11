import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { useAppTheme } from "@/theme";
import { border, size, space } from "@/theme/tokens";
import { type ChartSeries, lineWidth } from "@/utils/progress-chart";

export function ChartLegend({
	series,
	target,
}: {
	series: ChartSeries[];
	target?: number | null;
}) {
	const { t } = useTranslation();
	const theme = useAppTheme();
	return (
		<View style={{ gap: space.sm }}>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
				{series.map(({ hands }) => (
					<View
						key={hands}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: space.xs,
						}}
					>
						<View
							style={{
								width: space.lg,
								borderTopWidth: size.marker,
								borderColor:
									hands === "LH"
										? theme.colors.handLeft
										: hands === "RH"
											? theme.colors.handRight
											: theme.colors.onSurface,
							}}
						/>
						<Text
							variant="labelSmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{hands && t(`screen.progressChart.hands.${hands}`)}
						</Text>
					</View>
				))}
				{target != null && (
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: space.xs,
						}}
					>
						<View
							style={{
								width: space.xl,
								borderTopWidth: border.hairline,
								borderStyle: "dashed",
								borderColor: theme.colors.outline,
							}}
						/>
						<Text
							variant="labelSmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("screen.progressChart.target")}
						</Text>
					</View>
				)}
			</View>
			<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
				{(["clean", "slips", "shaky"] as const).map((accuracy) => (
					<View
						key={accuracy}
						style={{
							flexDirection: "row",
							alignItems: "center",
							gap: space.xs,
						}}
					>
						<View
							style={{
								width: space.xl,
								borderTopWidth: lineWidth(accuracy),
								borderColor:
									accuracy === "clean"
										? theme.colors.outline
										: theme.colors.onSurface,
							}}
						/>
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t(`screen.progressChart.accuracy.${accuracy}`)}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}
