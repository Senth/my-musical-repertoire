import "../global.css";
import "@/i18n";

import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

const lightTheme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: "#7B1FA2",
		primaryContainer: "#E1BEE7",
		secondary: "#9C27B0",
	},
};

const darkTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: "#CE93D8",
		primaryContainer: "#4A148C",
		secondary: "#BA68C8",
	},
};

function AuthGate() {
	const { user, loading } = useAuth();
	const segments = useSegments();
	const router = useRouter();

	useEffect(() => {
		if (loading) return;

		const inAuthGroup = segments[0] === "(auth)";

		if (!user && !inAuthGroup) {
			router.replace("/(auth)/login");
		} else if (user && inAuthGroup) {
			router.replace("/(app)/(tabs)/overview");
		}
	}, [user, loading, segments, router.replace]);

	return <Slot />;
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
