import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Divider, Text } from "react-native-paper";
import { useAppTheme } from "@/theme";
import { opacity, size, space } from "@/theme/tokens";
import {
	type ChartKind,
	type ChartSeries,
	summarise,
} from "@/utils/progress-chart";

export function HandSummary({
	series,
	target,
	kind,
}: {
	series: ChartSeries[];
	target?: number | null;
	kind: ChartKind;
}) {
	const { t } = useTranslation();
	const theme = useAppTheme();
	return (
		<View>
			{summarise(series, target).map(({ hands, currentBpm, gap, counts }) => {
				const color =
					hands === "LH"
						? theme.colors.handLeft
						: hands === "RH"
							? theme.colors.handRight
							: theme.colors.onSurface;
				return (
					<View
						key={hands ?? kind}
						testID={`progress-summary-${hands ?? kind}`}
					>
						<View style={{ gap: space.xs, paddingVertical: space.md }}>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									flexWrap: "wrap",
									gap: space.sm,
								}}
							>
								<View
									style={{
										width: space.md,
										height: size.marker,
										backgroundColor: color,
									}}
								/>
								<Text variant="bodyMedium" style={{ flex: 1 }}>
									{hands
										? t(`screen.progressChart.hands.${hands}`)
										: t(`screen.progressChart.series.${kind}`)}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t(
										gap == null
											? "screen.progressChart.current"
											: gap === 0
												? "screen.progressChart.atTarget"
												: "screen.progressChart.toGo",
										{ bpm: currentBpm, gap },
									)}
								</Text>
							</View>
							<View
								style={{
									flexDirection: "row",
									gap: space.xxs,
									height: size.track,
								}}
							>
								{(["shaky", "slips", "clean"] as const).map(
									(accuracy) =>
										counts[accuracy] > 0 && (
											<View
												key={accuracy}
												style={{
													flex: counts[accuracy],
													backgroundColor: color,
													opacity:
														accuracy === "shaky"
															? 1
															: accuracy === "slips"
																? (1 - opacity.quiet) * 2
																: 1 - opacity.quiet,
												}}
											/>
										),
								)}
							</View>
							<View
								style={{
									flexDirection: "row",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: space.xs,
								}}
							>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.progressChart.counts", counts)}
								</Text>
								<Text
									variant="bodySmall"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("screen.progressChart.practices", { count: counts.total })}
								</Text>
							</View>
						</View>
						<Divider />
					</View>
				);
			})}
		</View>
	);
}
