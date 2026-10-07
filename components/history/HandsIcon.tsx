import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, useTheme } from "react-native-paper";
import type { HandsMode } from "@/models/practice";
import { icon } from "@/theme/tokens";

export function HandsIcon({ hands }: { hands: HandsMode }) {
	const { t } = useTranslation();
	const theme = useTheme();
	return (
		<View
			accessible
			accessibilityLabel={t(`screen.practice.modes.handsLong.${hands}`)}
			style={{ flexDirection: "row", alignItems: "center" }}
		>
			{hands !== "RH" && (
				<Icon
					source="hand-back-left"
					size={icon.sm}
					color={theme.colors.outline}
				/>
			)}
			{hands !== "LH" && (
				<Icon
					source="hand-back-right"
					size={icon.sm}
					color={theme.colors.outline}
				/>
			)}
		</View>
	);
}
