import { Redirect } from "expo-router";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { shell } from "@/theme/tokens";

export default function Index() {
	const { user, loading } = useAuth();
	const colorScheme = useColorScheme();

	if (loading) {
		return (
			<View
				style={{
					flex: 1,
					minHeight: 0,
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: colorScheme === "dark" ? shell.dark : shell.light,
				}}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (user) {
		return <Redirect href="/(app)/(tabs)/overview" />;
	}

	return <Redirect href="/(auth)/login" />;
}
