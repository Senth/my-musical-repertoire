import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import { useAuth } from "@/contexts/AuthContext";
import { collectExportData } from "@/utils/export-data";
import { saveExport } from "./save-export";

/**
 * Downloads everything stored for the signed-in account as one JSON file.
 * Sits above the delete-account card on the privacy policy, so "save your
 * data, then delete" is one journey.
 */
export function ExportDataCard() {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user } = useAuth();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;

	const handleExport = async () => {
		setBusy(true);
		setError(null);
		try {
			const data = await collectExportData(user.uid);
			await saveExport(
				`my-musical-repertoire-export-${new Date().toISOString().slice(0, 10)}.json`,
				JSON.stringify(data, null, 2),
			);
		} catch {
			setError(t("screen.exportData.error"));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Card mode="outlined">
			<Card.Content>
				<View style={{ gap: 12 }}>
					<Text variant="bodyMedium">{t("screen.exportData.body")}</Text>
					<Button
						mode="outlined"
						icon="download"
						loading={busy}
						disabled={busy}
						onPress={handleExport}
					>
						{t("screen.exportData.button")}
					</Button>
					{error && (
						<Text variant="bodySmall" style={{ color: theme.colors.error }}>
							{t("screen.exportData.error")}
						</Text>
					)}
				</View>
			</Card.Content>
		</Card>
	);
}
