import { Stack } from "expo-router";

/** Public routes: the policy and terms have to be readable before signing up. */
export default function LegalLayout() {
	return (
		<Stack screenOptions={{ headerShown: false }}>
			<Stack.Screen name="privacy" />
			<Stack.Screen name="terms" />
		</Stack>
	);
}
