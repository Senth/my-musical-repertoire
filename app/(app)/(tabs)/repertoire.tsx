import { View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";

export default function RepertoireScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: theme.colors.background }}
    >
      <Text variant="bodyLarge">Your list goes here</Text>
    </View>
  );
}
