import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, useTheme } from "react-native-paper";
import { PracticeMistakes } from "@/models/practice";
import { icon, size, space } from "@/theme/tokens";
import { scoreSteps } from "@/utils/practice-history";

export const HISTORY_METRICS = {
	quality: "bullseye-arrow",
	effort: "arm-flex",
	technical: "piano",
	memory: "brain",
} as const;

type Metric = keyof typeof HISTORY_METRICS;

export function historyScoreLabel(
	metric: Metric,
	value: number | null | undefined,
	t: TFunction,
): string {
	const scale =
		metric === "quality" || metric === "effort" ? metric : "mistakes";
	const steps = scoreSteps(value, scale);
	return t("screen.history.score", {
		metric: t(`screen.history.metrics.${metric}`),
		value:
			steps === null
				? t("screen.practice.notRated")
				: scale === "mistakes"
					? t(
							`screen.practice.mistakeLevel.${PracticeMistakes[value as number]}`,
						)
					: t(`technique.${scale}.${value}`),
	});
}

export function ScoreMeter({
	metric,
	value,
}: {
	metric: Metric;
	value: number | null | undefined;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const steps = scoreSteps(
		value,
		metric === "quality" || metric === "effort" ? metric : "mistakes",
	);
	return (
		<View
			accessible
			accessibilityLabel={historyScoreLabel(metric, value, t)}
			style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
		>
			<Icon
				source={HISTORY_METRICS[metric]}
				size={icon.sm}
				color={theme.colors.onSurfaceVariant}
			/>
			<View style={{ flexDirection: "row", gap: space.xxs, flexShrink: 1 }}>
				{[1, 2, 3, 4, 5].map((step) => (
					<View
						key={step}
						style={{
							width: space.md,
							height: size.track,
							flexShrink: 1,
							backgroundColor:
								steps !== null && step <= steps
									? theme.colors.onSurfaceVariant
									: theme.colors.outlineVariant,
						}}
					/>
				))}
			</View>
		</View>
	);
}
