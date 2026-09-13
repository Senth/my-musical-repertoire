import "@/i18n";

import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { PaperProvider } from "react-native-paper";
import { OfflineBar } from "@/components/ui/OfflineBar";
import { UpdateBanner } from "@/components/ui/UpdateBanner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { darkTheme, lightTheme } from "@/theme";

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
