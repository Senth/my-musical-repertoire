import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { type MD3Theme, Text, useTheme } from "react-native-paper";
import { useOnlineStatus } from "@/hooks/use-online-status";

type AppTheme = MD3Theme & {
	colors: MD3Theme["colors"] & {
		warningContainer: string;
		onWarningContainer: string;
	};
};

/**
 * Slim status bar shown while the browser reports no connection. Sits above the
 * router so it reaches every screen, the login form and the coach included.
 */
export function OfflineBar() {
	const { t } = useTranslation();
	const theme = useTheme<AppTheme>();
	const online = useOnlineStatus();

	if (online) return null;

	return (
		<View
			accessibilityRole="alert"
			style={{
				backgroundColor: theme.colors.warningContainer,
				paddingVertical: 4,
				paddingHorizontal: 12,
			}}
		>
			<Text
				variant="labelMedium"
				style={{ color: theme.colors.onWarningContainer, textAlign: "center" }}
			>
				{t("common.offline.banner")}
			</Text>
		</View>
	);
}
