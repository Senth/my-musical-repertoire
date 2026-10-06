import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { space } from "@/theme/tokens";

export function BpmValue({ value }: { value: number | null | undefined }) {
	const { t, i18n } = useTranslation();
	const theme = useTheme();
	if (value == null) return null;
	return (
		<View
			style={{ flexDirection: "row", alignItems: "baseline", gap: space.xxs }}
		>
			<Text
				variant="bodyMedium"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("screen.history.bpmValue", {
					bpm: value.toLocaleString(i18n.language),
				})}
			</Text>
			<Text
				variant="labelSmall"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("common.tempo.unit")}
			</Text>
		</View>
	);
}
