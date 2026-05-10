import { Stack } from "expo-router";

export default function AppLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="(tabs)" />
			<Stack.Screen name="add-piece" />
			<Stack.Screen name="edit-piece" />
			<Stack.Screen name="pieces" />
			<Stack.Screen name="practice" />
		</Stack>
	);
}
