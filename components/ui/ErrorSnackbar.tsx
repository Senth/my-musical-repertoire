import { useTranslation } from "react-i18next";
import { Snackbar } from "react-native-paper";

interface ErrorSnackbarProps {
	/** The error message to show, or null to hide the snackbar. */
	error: string | null;
	onDismiss: () => void;
}

/** Dismissible error snackbar with a localized "OK" action. */
export function ErrorSnackbar({ error, onDismiss }: ErrorSnackbarProps) {
	const { t } = useTranslation();
	return (
		<Snackbar
			visible={!!error}
			onDismiss={onDismiss}
			duration={4000}
			action={{ label: t("common.ok"), onPress: onDismiss }}
		>
			{error ?? ""}
		</Snackbar>
	);
}
