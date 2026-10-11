import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { ChartLegend } from "@/components/progress/ChartLegend";
import { HandSummary } from "@/components/progress/HandSummary";
import { RangeChips } from "@/components/progress/RangeChips";
import { TempoChart } from "@/components/progress/TempoChart";
import {
	type ProgressScope,
	useProgressSeries,
} from "@/hooks/use-progress-series";
import { space } from "@/theme/tokens";
import { historyDayKey } from "@/utils/practice-history";
import { type ChartRange, summarise, yDomain } from "@/utils/progress-chart";

export function ProgressHeader({
	scope,
	target,
}: {
	scope: ProgressScope;
	target?: number | null;
}) {
	const { t, i18n } = useTranslation();
	const theme = useTheme();
	const [range, setRange] = useState<ChartRange>("3m");
	const [width, setWidth] = useState(0);
	const { series, loading, error } = useProgressSeries(scope, range);
	const points = series.flatMap(({ points }) => points);
	const enough =
		new Set(points.map(({ date }) => historyDayKey(date))).size >= 2;
	const lead = series.reduce<(typeof series)[number] | null>(
		(latest, candidate) =>
			(candidate.points.at(-1)?.date.getTime() ?? Number.NEGATIVE_INFINITY) >
			(latest?.points.at(-1)?.date.getTime() ?? Number.NEGATIVE_INFINITY)
				? candidate
				: latest,
		null,
	);
	const current = lead?.points.at(-1);
	const hand = lead?.hands ? t(`screen.progressChart.hands.${lead.hands}`) : "";
	const bpm = current?.bpm;
	const context = lead
		? t(
				target == null
					? "screen.progressChart.leadWithoutTarget"
					: "screen.progressChart.leadContext",
				{
					hand,
					target,
					first: lead.points[0].bpm,
					month: new Intl.DateTimeFormat(i18n.language, {
						month: "long",
					}).format(lead.points[0].date),
				},
			)
		: "";
	const leadText = t("screen.progressChart.lead", { bpm, context });
	const description = summarise(series, target)
		.map(({ hands, counts }) =>
			t("screen.progressChart.summaryA11y", {
				hand: hands ? t(`screen.progressChart.hands.${hands}`) : "",
				counts: t("screen.progressChart.counts", counts),
				practices: t("screen.progressChart.practices", { count: counts.total }),
			}),
		)
		.join(". ");
	return (
		<View
			style={{ gap: space.sm, paddingVertical: space.sm }}
			onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
		>
			<RangeChips range={range} onChange={setRange} />
			{loading ? (
				<ActivityIndicator
					accessibilityLabel={t("screen.progressChart.loading")}
				/>
			) : error ? (
				<Text variant="bodySmall" style={{ color: theme.colors.error }}>
					{t("screen.progressChart.loadError")}
				</Text>
			) : !enough ? (
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.progressChart.empty")}
				</Text>
			) : (
				<>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						<Text
							variant="bodyMedium"
							style={{ fontWeight: theme.fonts.labelLarge.fontWeight }}
						>
							{t("screen.progressChart.current", { bpm })}
						</Text>
						{context}
					</Text>
					{width > 0 && (
						<TempoChart
							series={series}
							target={target}
							domain={yDomain(series, target)}
							range={range}
							width={width}
							accessibilityLabel={t("screen.progressChart.chartA11y", {
								lead: leadText,
								summary: description,
							})}
						/>
					)}
					<ChartLegend series={series} target={target} />
					<View style={{ paddingTop: space.lg }}>
						<Text
							variant="labelSmall"
							style={{
								color: theme.colors.onSurfaceVariant,
								textTransform: "uppercase",
							}}
						>
							{t(`screen.progressChart.summaryRange.${range}`)}
						</Text>
						<HandSummary series={series} target={target} />
					</View>
				</>
			)}
		</View>
	);
}
