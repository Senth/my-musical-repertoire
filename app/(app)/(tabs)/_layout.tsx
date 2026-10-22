import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { IconSymbol } from "@/components/ui/icon-symbol";
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
						<IconSymbol
							size={icon.tab}
							name="music.note.list"
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
						<IconSymbol
							size={icon.tab}
							name="books.vertical"
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
						<IconSymbol
							size={icon.tab}
							name="pianokeys"
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
						<IconSymbol
							size={icon.tab}
							name="chart.line.uptrend.xyaxis"
							color={tint(focused)}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
