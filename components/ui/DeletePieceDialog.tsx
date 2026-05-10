import { useTranslation } from "react-i18next";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

interface Props {
	visible: boolean;
	pieceName: string;
	loading?: boolean;
	onConfirm: () => void;
	onDismiss: () => void;
}

export function DeletePieceDialog({
	visible,
	pieceName,
	loading = false,
	onConfirm,
	onDismiss,
}: Props) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onDismiss}>
				<Dialog.Title>{t("screen.pieces.deleteDialog.title")}</Dialog.Title>
				<Dialog.Content>
					<Text variant="bodyMedium">
						{t("screen.pieces.deleteDialog.message", { name: pieceName })}
					</Text>
				</Dialog.Content>
				<Dialog.Actions>
					<Button onPress={onDismiss} disabled={loading}>
						{t("screen.pieces.deleteDialog.cancel")}
					</Button>
					<Button
						onPress={onConfirm}
						loading={loading}
						disabled={loading}
						textColor={theme.colors.error}
					>
						{t("screen.pieces.deleteDialog.confirm")}
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}
