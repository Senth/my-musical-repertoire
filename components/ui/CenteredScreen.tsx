import { View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";

/** Full-screen centered loading spinner over the theme background. */
export function LoadingScreen() {
	const theme = useTheme();
	return (
		<View
			className="flex-1 items-center justify-center"
			style={{ backgroundColor: theme.colors.background }}
		>
			<ActivityIndicator size="large" />
		</View>
	);
}

/** Full-screen centered message over the theme background (e.g. "not found"). */
export function MessageScreen({ message }: { message: string }) {
	const theme = useTheme();
	return (
		<View
			className="flex-1 items-center justify-center"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Text variant="bodyLarge">{message}</Text>
		</View>
	);
}
