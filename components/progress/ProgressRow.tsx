import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Divider,
	ProgressBar,
	Text,
	TouchableRipple,
} from "react-native-paper";
import type { HandsMode } from "@/models/practice";
import { useAppTheme } from "@/theme";
import { size, space } from "@/theme/tokens";
import {
	movedBy,
	progressFill,
	type ProgressRow as Row,
} from "@/utils/repertoire-progress";

export function ProgressRow({
	row,
	baseline,
}: {
	row: Row;
	baseline?: Partial<Record<HandsMode, number>>;
}) {
	const { t } = useTranslation();
	const theme = useAppTheme();
	const router = useRouter();
	const title =
		row.kind === "section" ? row.section.label : row.technique.title;
	const subtitle =
		row.kind === "section" ? row.piece.title : t("screen.techniques.title");
	const target = t("screen.progress.target", { bpm: row.target });
	return (
		<View>
			<TouchableRipple
				accessibilityRole="link"
				accessibilityLabel={[
					title,
					subtitle,
					target,
					...row.hands.map(({ hands, bpm }) =>
						t(
							movedBy(bpm, baseline?.[hands]) == null
								? "screen.progress.handTempo"
								: "screen.progress.handTempoMoved",
							{
								hand: t(`screen.progressChart.hands.${hands}`),
								bpm,
								delta: movedBy(bpm, baseline?.[hands]),
							},
						),
					),
				].join(". ")}
				onPress={() =>
					router.push(
						row.kind === "section"
							? `/piece/${row.piece.id}/history?sectionId=${row.section.id}`
							: `/technique/${row.technique.id}/history`,
					)
				}
			>
				<View style={{ paddingVertical: space.md, gap: space.xxs }}>
					<View
						style={{
							flexDirection: "row",
							alignItems: "baseline",
							gap: space.sm,
						}}
					>
						<Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>
							{title}
						</Text>
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{target}
						</Text>
					</View>
					<Text
						variant="bodySmall"
						numberOfLines={1}
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{subtitle}
					</Text>
					{row.hands.map(({ hands, bpm }) => {
						const delta = movedBy(bpm, baseline?.[hands]);
						const color =
							hands === "LH"
								? theme.colors.handLeft
								: hands === "RH"
									? theme.colors.handRight
									: theme.colors.onSurface;
						return (
							<View
								key={hands}
								testID={`progress-bar-${hands}`}
								style={{
									flexDirection: "row",
									alignItems: "center",
									gap: space.sm,
								}}
							>
								<Text
									variant="labelSmall"
									style={{ width: space.xl, fontWeight: "bold", color }}
								>
									{t(`screen.progressChart.handsShort.${hands}`)}
								</Text>
								<View style={{ flex: 1 }}>
									<ProgressBar
										testID={`progress-fill-${hands}`}
										progress={progressFill(bpm, row.target)}
										color={color}
										style={{
											height: size.track,
											borderRadius: 0,
											backgroundColor: theme.colors.outlineVariant,
										}}
									/>
								</View>
								<Text
									variant="labelSmall"
									style={{ minWidth: space.xxl, textAlign: "right" }}
								>
									{t("screen.progressChart.axisBpm", { bpm })}
								</Text>
								<View style={{ width: space.xxl }}>
									{delta != null && (
										<Text
											testID={`progress-moved-${hands}`}
											variant="labelSmall"
											numberOfLines={1}
											style={{
												textAlign: "right",
												color: theme.colors.onSurfaceVariant,
											}}
										>
											{t("screen.progress.movedValue", { delta })}
										</Text>
									)}
								</View>
							</View>
						);
					})}
				</View>
			</TouchableRipple>
			<Divider />
		</View>
	);
}
