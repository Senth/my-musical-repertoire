import "@/global.css";
import "@/i18n";

import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { OfflineBar } from "@/components/ui/OfflineBar";
import { UpdateBanner } from "@/components/ui/UpdateBanner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

const lightTheme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: "#006566",
		onPrimary: "#FFFFFF",
		primaryContainer: "#BCE8E7",
		onPrimaryContainer: "#002829",
		secondary: "#3B6363",
		onSecondary: "#FFFFFF",
		secondaryContainer: "#CDE8E7",
		onSecondaryContainer: "#052A2A",
		surface: "#FCFCFC",
		background: "#FCFCFC",
		surfaceVariant: "#E3E3E3",
		outline: "#767676",
		outlineVariant: "#C7C7C7",
		elevation: {
			level0: "transparent",
			level1: "#EFF4F4",
			level2: "#E8F0F0",
			level3: "#E0EBEC",
			level4: "#DEEAEA",
			level5: "#D9E7E7",
		},
		warning: "#B45309",
		onWarning: "#FFFFFF",
		warningContainer: "#FEF3C7",
		onWarningContainer: "#78350F",
		success: "#047857",
		onSuccess: "#FFFFFF",
		successContainer: "#D1FAE5",
		onSuccessContainer: "#064E3B",
	},
};

const darkTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: "#7BDAD9",
		onPrimary: "#003232",
		primaryContainer: "#00494A",
		onPrimaryContainer: "#BCE8E7",
		secondary: "#AAD0CF",
		onSecondary: "#162E2D",
		secondaryContainer: "#264343",
		onSecondaryContainer: "#CAE4E4",
		surface: "#1C1C1C",
		background: "#1C1C1C",
		surfaceVariant: "#474747",
		outline: "#919191",
		outlineVariant: "#474747",
		elevation: {
			level0: "transparent",
			level1: "#212625",
			level2: "#242B2B",
			level3: "#263131",
			level4: "#273333",
			level5: "#293736",
		},
		warning: "#FCD34D",
		onWarning: "#78350F",
		warningContainer: "#92400E",
		onWarningContainer: "#FEF3C7",
		success: "#34D399",
		onSuccess: "#064E3B",
		successContainer: "#065F46",
		onSuccessContainer: "#D1FAE5",
	},
};

function AuthGate() {
	const { user, loading } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (loading) return;

		const inAuthGroup = segments[0] === "(auth)";
		// The policy and terms must be readable without an account — a signed-out
		// visitor following the link from login cannot be bounced back to it.
		const inLegalGroup = segments[0] === "(legal)";

		if (!user && !inAuthGroup && !inLegalGroup) {
			router.replace("/(auth)/login");
		} else if (user && inAuthGroup) {
			router.replace("/(app)/(tabs)/overview");
		}
	}, [user, loading, segments, router.replace]);

	// The offline bar sits above the router so every screen shows it, login and
	// the coach included; the update banner is a Snackbar and floats on top.
	return (
		<View style={{ flex: 1 }}>
			<OfflineBar />
			<Slot />
			<UpdateBanner />
		</View>
	);
}

export default function RootLayout() {
	const colorScheme = useColorScheme();

	return (
		<PaperProvider theme={colorScheme === "dark" ? darkTheme : lightTheme}>
			<AuthProvider>
				<AuthGate />
				<StatusBar style="auto" />
			</AuthProvider>
		</PaperProvider>
	);
}
