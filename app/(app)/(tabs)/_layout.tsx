import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { icon } from "@/theme/tokens";

export default function AppTabsLayout() {
	const theme = useTheme();
	const { t } = useTranslation();

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
					tabBarIcon: ({ color }) => (
						<IconSymbol size={icon.tab} name="music.note.list" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="piece"
				options={{
					title: t("screen.pieces.title"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={icon.tab} name="books.vertical" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="technique"
				options={{
					title: t("screen.techniques.title"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={icon.tab} name="pianokeys" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="progress"
				options={{
					title: t("screen.progress.title"),
					headerShown: false,
					tabBarIcon: ({ color }) => (
						<IconSymbol
							size={icon.tab}
							name="chart.line.uptrend.xyaxis"
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	);
}
