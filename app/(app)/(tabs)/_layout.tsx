import { Tabs } from "expo-router";
import { useTheme } from "react-native-paper";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AppTabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.onPrimary,
      }}
    >
      <Tabs.Screen
        name="repertoire"
        options={{
          title: "My Repertoire",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="music.note.list" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
