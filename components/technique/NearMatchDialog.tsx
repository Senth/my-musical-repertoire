import { useTranslation } from "react-i18next";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
	Button,
	Dialog,
	Portal,
	Text,
	TouchableRipple,
	useTheme,
} from "react-native-paper";
import {
	border,
	contentWidth,
	radius,
	space,
	touchTarget,
} from "@/theme/tokens";

interface NearMatchDialogProps {
	currentTitle: string;
	catalogTitle: string;
	progress?: { n: number; total: number; others: number };
	onAnswer: (answer: "keep" | "rename" | "add") => void;
	onDismiss: () => void;
}

export function NearMatchDialog({
	currentTitle,
	catalogTitle,
	progress,
	onAnswer,
	onDismiss,
}: NearMatchDialogProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { width } = useWindowDimensions();
	const titles = { currentTitle, catalogTitle };

	return (
		<Portal>
			<Dialog
				visible
				onDismiss={onDismiss}
				style={{
					alignSelf: "center",
					width: Math.min(contentWidth.form, width - space.xl * 2),
					maxHeight: "100%",
				}}
			>
				<Dialog.Title>
					{t("technique.catalog.confirm.title", titles)}
				</Dialog.Title>
				<Dialog.ScrollArea
					style={{
						borderTopWidth: 0,
						borderBottomWidth: 0,
						paddingHorizontal: 0,
					}}
				>
					<ScrollView>
						<Dialog.Content>
							<Text
								variant={progress ? "bodySmall" : "bodyMedium"}
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{progress
									? t("technique.catalog.confirm.progress", progress)
									: t("technique.catalog.confirm.body", titles)}
							</Text>
							<View style={{ gap: space.sm, marginTop: space.xl }}>
								{(["keep", "rename", "add"] as const).map((answer) => (
									<TouchableRipple
										key={answer}
										accessibilityRole="button"
										accessibilityLabel={t(
											`technique.catalog.confirm.${answer}`,
											titles,
										)}
										onPress={() => onAnswer(answer)}
										borderless
										style={{
											borderWidth: border.hairline,
											borderColor: theme.colors.outline,
											borderRadius: radius.full,
											minHeight: touchTarget.minimum,
											justifyContent: "center",
											paddingHorizontal: space.lg,
											paddingVertical: space.md,
										}}
									>
										<Text
											variant="labelLarge"
											style={{
												color: theme.colors.primary,
												textAlign: "center",
											}}
										>
											{t(`technique.catalog.confirm.${answer}`, titles)}
										</Text>
									</TouchableRipple>
								))}
							</View>
						</Dialog.Content>
					</ScrollView>
				</Dialog.ScrollArea>
				<Dialog.Actions>
					<Button onPress={onDismiss}>
						{progress
							? t("technique.catalog.confirm.cancelAll")
							: t("technique.catalog.confirm.cancel")}
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}
