import { useTranslation } from "react-i18next";
import Svg, { G, Line, Text } from "react-native-svg";
import { useAppTheme } from "@/theme";
import { border, size, space } from "@/theme/tokens";
import {
	type ChartRange,
	type ChartSeries,
	lineWidth,
	monthTicks,
	rangeStart,
} from "@/utils/progress-chart";

export function TempoChart({
	series,
	target,
	domain,
	range,
	width,
	accessibilityLabel,
}: {
	series: ChartSeries[];
	target?: number | null;
	domain: [number, number];
	range: ChartRange;
	width: number;
	accessibilityLabel: string;
}) {
	const theme = useAppTheme();
	const { t, i18n } = useTranslation();
	const height = size.md * 2 + space.sm;
	const left = space.xxl;
	const right = width - space.xxl;
	const top = space.lg;
	const bottom = height - space.xl;
	const dates = series.flatMap(({ points }) =>
		points.map(({ date }) => date.getTime()),
	);
	const end = new Date(Math.max(Date.now(), ...dates));
	const start = rangeStart(range, end) ?? new Date(Math.min(...dates));
	const x = (date: Date) =>
		left +
		((date.getTime() - start.getTime()) /
			Math.max(1, end.getTime() - start.getTime())) *
			(right - left);
	const y = (bpm: number) =>
		bottom - ((bpm - domain[0]) / (domain[1] - domain[0])) * (bottom - top);
	const ticks = monthTicks(start, end, i18n.language);
	const tickStep = Math.max(
		1,
		Math.ceil(
			ticks.length /
				Math.max(1, Math.floor((right - left) / (size.control * 2))),
		),
	);
	const font = theme.fonts.bodySmall;
	return (
		<Svg
			width={width}
			height={height}
			accessibilityRole="image"
			accessibilityLabel={accessibilityLabel}
		>
			{Array.from(
				{ length: (domain[1] - domain[0]) / 10 + 1 },
				(_, index) => domain[0] + index * 10,
			).map((bpm) => (
				<G key={bpm}>
					{bpm !== target && (
						<Line
							x1={left}
							x2={right}
							y1={y(bpm)}
							y2={y(bpm)}
							stroke={theme.colors.outlineVariant}
							strokeWidth={border.hairline}
						/>
					)}
					{(target == null || Math.abs(bpm - target) >= 5) && (
						<Text
							x={left - space.sm}
							y={y(bpm)}
							alignmentBaseline="middle"
							textAnchor="end"
							fill={theme.colors.onSurfaceVariant}
							fontSize={font.fontSize}
							fontFamily={font.fontFamily}
						>
							{t("screen.progressChart.axisBpm", { bpm })}
						</Text>
					)}
				</G>
			))}
			{target != null && (
				<G>
					<Line
						x1={left}
						x2={right}
						y1={y(target)}
						y2={y(target)}
						stroke={theme.colors.outline}
						strokeWidth={border.hairline}
						strokeDasharray="6 4"
					/>
					<Text
						x={left - space.sm}
						y={y(target)}
						alignmentBaseline="middle"
						textAnchor="end"
						fill={theme.colors.onSurface}
						fontSize={font.fontSize}
						fontFamily={font.fontFamily}
						fontWeight={theme.fonts.labelLarge.fontWeight}
					>
						{t("screen.progressChart.axisBpm", { bpm: target })}
					</Text>
				</G>
			)}
			{ticks
				.filter((_, index) => index % tickStep === 0)
				.map(({ date, label }) => (
					<Text
						key={date.getTime()}
						x={x(date)}
						y={height - space.xs}
						textAnchor="middle"
						fill={theme.colors.onSurfaceVariant}
						fontSize={font.fontSize}
						fontFamily={font.fontFamily}
					>
						{label}
					</Text>
				))}
			{series.map(({ hands, points }) => {
				const color =
					hands === "LH"
						? theme.colors.handLeft
						: hands === "RH"
							? theme.colors.handRight
							: theme.colors.onSurface;
				const last = points.at(-1);
				return (
					<G key={hands}>
						{points.slice(1).map((point, index) => (
							<Line
								key={`${point.date.getTime()}-${point.bpm}-${point.accuracy}`}
								x1={x(points[index].date)}
								y1={y(points[index].bpm)}
								x2={x(point.date)}
								y2={y(point.bpm)}
								stroke={color}
								strokeWidth={lineWidth(point.accuracy)}
								strokeLinecap="round"
							/>
						))}
						{last && hands && (
							<Text
								x={x(last.date) + space.xs}
								y={y(last.bpm)}
								alignmentBaseline="middle"
								fill={color}
								fontSize={font.fontSize}
								fontFamily={font.fontFamily}
								fontWeight={theme.fonts.labelLarge.fontWeight}
							>
								{t(`screen.progressChart.handsShort.${hands}`)}
							</Text>
						)}
					</G>
				);
			})}
		</Svg>
	);
}
