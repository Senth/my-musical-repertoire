import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";

/**
 * Privacy policy and terms links. Shown under the sign-in form so the terms are
 * readable before an account exists, and at the foot of the overview so they
 * stay findable afterwards.
 */
export function LegalLinks() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();

	const linkStyle = {
		color: theme.colors.onSurfaceVariant,
		textDecorationLine: "underline",
	} as const;

	return (
		<View className="flex-row justify-center items-center gap-3 flex-wrap">
			<Text
				variant="bodySmall"
				style={linkStyle}
				accessibilityRole="link"
				onPress={() => router.push("/(legal)/privacy")}
			>
				{t("screen.legal.privacy")}
			</Text>
			{/* Decorative: it separates the two links and says nothing itself.
			    `outline` is a border role, and using it for text lands at
			    4.44:1 — under AA. */}
			<Text
				variant="bodySmall"
				aria-hidden
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				·
			</Text>
			<Text
				variant="bodySmall"
				style={linkStyle}
				accessibilityRole="link"
				onPress={() => router.push("/(legal)/terms")}
			>
				{t("screen.legal.terms")}
			</Text>
		</View>
	);
}
