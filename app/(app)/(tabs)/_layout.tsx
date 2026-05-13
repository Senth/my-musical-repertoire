import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AppTabsLayout() {
	const theme = useTheme();
	const { t } = useTranslation();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.colors.primary,
			}}
		>
			<Tabs.Screen
				name="overview"
				options={{
					title: t("screen.overview.title"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name="music.note.list" color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="techniques"
				options={{
					title: t("screen.techniques.title"),
					tabBarIcon: ({ color }) => (
						<IconSymbol size={28} name="pianokeys" color={color} />
					),
				}}
			/>
		</Tabs>
	);
}
