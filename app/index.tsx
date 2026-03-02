import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/(app)/(tabs)/repertoire" />;
  }

  return <Redirect href="/(auth)/login" />;
}
