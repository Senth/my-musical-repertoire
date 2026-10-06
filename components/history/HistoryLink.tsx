import { useTranslation } from "react-i18next";
import type { StyleProp, ViewStyle } from "react-native";
import { List } from "react-native-paper";

export function HistoryLink({
	onPress,
	style,
}: {
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
}) {
	const { t } = useTranslation();
	const title = t("screen.history.entryTitle");
	return (
		<List.Item
			title={title}
			accessibilityRole="link"
			accessibilityLabel={title}
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
