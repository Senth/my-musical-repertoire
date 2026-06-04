import type { ReactNode } from "react";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import { Appbar, Card, useTheme } from "react-native-paper";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";

const MD3_MEDIUM_BREAKPOINT = 600;

interface FormScaffoldProps {
	title: string;
	subtitle?: string;
	onBack: () => void;
	error: string | null;
	onDismissError: () => void;
	children: ReactNode;
}

/**
 * Shared chrome for the add/edit form screens: a back-action header, a
 * keyboard-avoiding scroll area wrapping the form in a responsive Card, and an
 * error Snackbar. The form fields are passed as `children`.
 */
export function FormScaffold({
	title,
	subtitle,
	onBack,
	error,
	onDismissError,
	children,
}: FormScaffoldProps) {
	const theme = useTheme();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={onBack} />
				<Appbar.Content title={title} subtitle={subtitle} />
			</Appbar.Header>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1"
			>
				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: isCompact ? 16 : 24,
						paddingTop: 24,
						paddingBottom: 40,
					}}
					keyboardShouldPersistTaps="handled"
				>
					<View className="w-full max-w-xl self-center">
						<Card
							mode={isCompact ? "contained" : "elevated"}
							style={
								isCompact
									? { backgroundColor: "transparent", elevation: 0 }
									: undefined
							}
						>
							<Card.Content
								style={isCompact ? { paddingHorizontal: 0 } : undefined}
							>
								{children}
							</Card.Content>
						</Card>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>

			<ErrorSnackbar error={error} onDismiss={onDismissError} />
		</View>
	);
}
