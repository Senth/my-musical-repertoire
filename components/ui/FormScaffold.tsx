import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { Appbar, Card, useTheme } from "react-native-paper";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { useIsCompact } from "@/hooks/use-is-compact";
import { usePageInset } from "@/hooks/use-page-inset";
import { contentWidth, scrollTail, space } from "@/theme/tokens";

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
	const isCompact = useIsCompact();
	const pageInset = usePageInset();

	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				backgroundColor: theme.colors.background,
			}}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={onBack} />
				<Appbar.Content title={title} subtitle={subtitle} />
			</Appbar.Header>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={{ flex: 1, minHeight: 0 }}
			>
				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: pageInset,
						paddingTop: space.xl,
						paddingBottom: scrollTail.plain,
					}}
					keyboardShouldPersistTaps="handled"
				>
					<View
						style={{
							width: "100%",
							maxWidth: contentWidth.page,
							alignSelf: "center",
						}}
					>
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
