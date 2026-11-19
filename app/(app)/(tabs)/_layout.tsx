import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { icon } from "@/theme/tokens";

export default function AppTabsLayout() {
	const theme = useTheme();
	const { t } = useTranslation();
	const tint = (focused: boolean) =>
		focused ? theme.colors.primary : theme.colors.onSurfaceVariant;

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.colors.primary,
				tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
				tabBarStyle: { backgroundColor: theme.colors.elevation.level2 },
				headerStyle: { backgroundColor: theme.colors.elevation.level2 },
				headerTintColor: theme.colors.onSurface,
			}}
		>
			<Tabs.Screen
				name="overview"
				options={{
					title: t("screen.overview.title"),
					tabBarIcon: ({ focused }) => (
						<MaterialCommunityIcons
							size={icon.tab}
							name="playlist-music"
							color={tint(focused)}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="piece"
				options={{
					title: t("screen.pieces.title"),
					tabBarIcon: ({ focused }) => (
						<MaterialCommunityIcons
							size={icon.tab}
							name="bookshelf"
							color={tint(focused)}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="technique"
				options={{
					title: t("screen.techniques.title"),
					tabBarIcon: ({ focused }) => (
						<MaterialCommunityIcons
							size={icon.tab}
							name="piano"
							color={tint(focused)}
						/>
					),
				}}
			/>
			<Tabs.Screen
				name="progress"
				options={{
					title: t("screen.progress.title"),
					headerShown: false,
					tabBarIcon: ({ focused }) => (
						<MaterialCommunityIcons
							size={icon.tab}
							name="trending-up"
							color={tint(focused)}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
