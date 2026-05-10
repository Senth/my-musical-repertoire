import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	KeyboardAvoidingView,
	Platform,
	useWindowDimensions,
	View,
} from "react-native";
import {
	Appbar,
	Button,
	Card,
	Snackbar,
	TextInput,
	useTheme,
} from "react-native-paper";
import { usePieces, useUpdatePiece } from "@/hooks/use-pieces";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function EditPieceScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const { pieces } = usePieces();
	const { updatePiece } = useUpdatePiece();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const piece = pieces.find((p) => p.id === id);

	const [title, setTitle] = useState(piece?.title ?? "");
	const [composer, setComposer] = useState(piece?.composer ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasSeeded = useRef(false);

	// Seed form once the piece loads from Firestore (avoids resetting user edits on re-renders)
	useEffect(() => {
		if (piece && !hasSeeded.current) {
			setTitle(piece.title);
			setComposer(piece.composer);
			hasSeeded.current = true;
		}
	}, [piece]);

	const handleSave = async () => {
		if (!title.trim()) {
			setError(t("screen.editPiece.error.titleRequired"));
			return;
		}
		if (!composer.trim()) {
			setError(t("screen.editPiece.error.composerRequired"));
			return;
		}
		if (!id) return;

		setLoading(true);
		setError(null);

		try {
			await updatePiece(id, { title: title.trim(), composer: composer.trim() });
			router.back();
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	const formContent = (
		<View className="gap-4">
			<TextInput
				label={t("screen.editPiece.titleLabel")}
				value={title}
				onChangeText={setTitle}
				mode="outlined"
				autoFocus
			/>

			<TextInput
				label={t("screen.editPiece.composerLabel")}
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
				{t("screen.editPiece.save")}
			</Button>
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t("screen.editPiece.title")} />
			</Appbar.Header>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1"
				style={{ paddingHorizontal: isCompact ? 16 : 24, paddingTop: 24 }}
			>
				<View className="w-full max-w-xl self-center">
					{isCompact ? (
						formContent
					) : (
						<Card mode="elevated">
							<Card.Content>{formContent}</Card.Content>
						</Card>
					)}
				</View>
			</KeyboardAvoidingView>

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
