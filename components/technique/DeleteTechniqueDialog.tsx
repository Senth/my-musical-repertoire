import { useTranslation } from "react-i18next";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

interface Props {
	visible: boolean;
	techniqueName: string;
	loading?: boolean;
	onConfirm: () => void;
	onDismiss: () => void;
}

export function DeleteTechniqueDialog({
	visible,
	techniqueName,
	loading = false,
	onConfirm,
	onDismiss,
}: Props) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onDismiss}>
				<Dialog.Title>{t("screen.techniques.deleteDialog.title")}</Dialog.Title>
				<Dialog.Content>
					<Text variant="bodyMedium">
						{t("screen.techniques.deleteDialog.message", {
							name: techniqueName,
						})}
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={loading}>
						{t("screen.techniques.deleteDialog.cancel")}
					</Button>
					<Button
						onPress={onConfirm}
						loading={loading}
						disabled={loading}
						textColor={theme.colors.error}
					>
						{t("screen.techniques.deleteDialog.confirm")}
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}
