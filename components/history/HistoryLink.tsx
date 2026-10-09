import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { List, Text, useTheme } from "react-native-paper";

export function HistoryLink({
	onPress,
	style,
	title,
	description,
}: {
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	title?: string;
	description?: string;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const label = title ?? t("screen.history.entryTitle");
	return (
		<List.Item
			title={label}
			description={
				description
					? () => (
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{description}
							</Text>
						)
					: undefined
			}
			accessibilityRole="link"
			accessibilityLabel={label}
			accessibilityHint={description}
			left={(props) => (
				<List.Icon
					{...props}
					style={[props.style, { marginLeft: 0 }]}
					icon="history"
				/>
			)}
			right={(props) => <List.Icon {...props} icon="chevron-right" />}
			onPress={onPress}
			style={[{ paddingRight: 0 }, style]}
		/>
	);
}
