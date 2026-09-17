import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { space } from "@/theme/tokens";
import { buildId } from "@/utils/build-info";

/**
 * Privacy policy and terms links, with the build stamp beneath them. Shown
 * under the sign-in form so the terms are readable before an account exists,
 * and at the foot of the overview so they stay findable afterwards.
 */
export function LegalLinks() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();

	const linkStyle = {
		color: theme.colors.onSurfaceVariant,
		textDecorationLine: "underline",
	} as const;

	const rowStyle = {
		flexDirection: "row",
		justifyContent: "center",
		alignItems: "center",
		gap: space.md,
		flexWrap: "wrap",
	} as const;

	return (
		<>
			<View style={rowStyle}>
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
			<View style={[rowStyle, { marginTop: space.sm, opacity: 0.75 }]}>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("app.name")}
				</Text>
				<Text
					variant="bodySmall"
					aria-hidden
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					·
				</Text>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{buildId}
				</Text>
			</View>
		</>
	);
}
