import { useState } from "react";
import { View } from "react-native";
import { TextInput, Button, Appbar, Snackbar, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useAddPiece } from "@/hooks/use-pieces";

export default function AddPieceScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { addPiece } = useAddPiece();

	const [title, setTitle] = useState("");
	const [composer, setComposer] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSave = async () => {
		if (!title.trim()) {
			setError(t("screen.addPiece.error.titleRequired"));
			return;
		}
		if (!composer.trim()) {
			setError(t("screen.addPiece.error.composerRequired"));
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await addPiece(title.trim(), composer.trim());
			router.back();
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.BackAction
					onPress={() => router.back()}
					color={theme.colors.onPrimary}
				/>
				<Appbar.Content
					title={t("screen.addPiece.title")}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			<View className="p-4 gap-4">
				<TextInput
					label={t("screen.addPiece.titleLabel")}
					value={title}
					onChangeText={setTitle}
					mode="outlined"
					autoFocus
				/>

				<TextInput
					label={t("screen.addPiece.composerLabel")}
					value={composer}
					onChangeText={setComposer}
					mode="outlined"
				/>

				<Button
					mode="contained"
					onPress={handleSave}
					loading={loading}
					disabled={loading}
				>
					{t("screen.addPiece.save")}
				</Button>
			</View>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: "OK", onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
