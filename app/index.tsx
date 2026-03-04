import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View, useColorScheme } from "react-native";

export default function Index() {
	const { user, loading } = useAuth();
	const colorScheme = useColorScheme();

	if (loading) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{
					backgroundColor: colorScheme === "dark" ? "#1c1b1f" : "#fffbfe",
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
