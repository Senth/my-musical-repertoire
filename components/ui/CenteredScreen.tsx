import { View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Icon,
	Text,
	useTheme,
} from "react-native-paper";
import { usePageInset } from "@/hooks/use-page-inset";
import { contentWidth, icon as iconSize, space } from "@/theme/tokens";

/** Full-screen centered loading spinner over the theme background. */
export function LoadingScreen() {
	const theme = useTheme();
	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: theme.colors.background,
			}}
		>
			<ActivityIndicator size="large" />
		</View>
	);
}

/** Full-screen centered message over the theme background (e.g. "not found"). */
export function MessageScreen({
	message,
	icon,
	body,
	action,
}: {
	message: string;
	icon?: string;
	body?: string;
	action?: { label: string; onPress: () => void };
}) {
	const theme = useTheme();
	const pageInset = usePageInset();
	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: theme.colors.background,
			}}
		>
			<View
				style={{
					width: "100%",
					maxWidth: contentWidth.page,
					paddingHorizontal: pageInset,
					gap: space.lg,
					alignItems: "center",
				}}
			>
				{icon && (
					<Icon
						source={icon}
						size={iconSize.md}
						color={theme.colors.onSurfaceVariant}
					/>
				)}
				<Text variant="bodyLarge" style={{ textAlign: "center" }}>
					{message}
				</Text>
				{body && (
					<Text
						variant="bodyMedium"
						style={{
							textAlign: "center",
							color: theme.colors.onSurfaceVariant,
						}}
					>
						{body}
					</Text>
				)}
				{action && (
					<Button mode="contained" onPress={action.onPress}>
						{action.label}
					</Button>
				)}
			</View>
		</View>
	);
}
