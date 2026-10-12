import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import { Chip, TouchableRipple } from "react-native-paper";
import { radius, space, type } from "@/theme/tokens";
import type { ChartRange } from "@/utils/progress-chart";

export function RangeChips({
	range,
	onChange,
}: {
	range: ChartRange;
	onChange: (range: ChartRange) => void;
}) {
	const { t } = useTranslation();
	return (
		<View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
			{(["1m", "3m", "1y", "all"] as const).map((value) => (
				<TouchableRipple
					key={value}
					borderless
					accessibilityRole="button"
					accessibilityLabel={t(`screen.progressChart.ranges.${value}`)}
					accessibilityState={{ selected: value === range }}
					aria-pressed={value === range}
					onPress={() => onChange(value)}
					hitSlop={
						Platform.OS === "web"
							? undefined
							: {
									top: space.sm,
									bottom: space.sm,
									left: space.xs,
									right: space.xs,
								}
					}
					style={{ borderRadius: radius.chip }}
				>
					<Chip
						compact
						mode={value === range ? "flat" : "outlined"}
						selected={value === range}
						showSelectedCheck={false}
						accessibilityRole="text"
						accessible={false}
						accessibilityElementsHidden
						importantForAccessibility="no-hide-descendants"
						pointerEvents="none"
						style={{ borderRadius: radius.chip }}
						textStyle={{
							fontSize: type.labelSmall,
							lineHeight: type.labelSmallLineHeight,
						}}
					>
						{t(`screen.progressChart.ranges.${value}`)}
					</Chip>
				</TouchableRipple>
			))}
		</View>
	);
}
