import { useRouter } from "expo-router";
import { useState } from "react";
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
import { DropdownField } from "@/components/ui/DropdownField";
import { useAddPiece } from "@/hooks/use-pieces";
import { PIECE_STATES, type PieceState } from "@/models/piece";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function AddPieceScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { addPiece } = useAddPiece();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const [title, setTitle] = useState("");
	const [composer, setComposer] = useState("");
	const [state, setState] = useState<PieceState>("learning");
	const [targetTempoBpmText, setTargetTempoBpmText] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const stateOptions = PIECE_STATES.map((s) => ({
		value: s,
		label: t(`piece.state.${s}`),
	}));

	const handleSave = async () => {
		if (!title.trim()) {
			setError(t("screen.addPiece.error.titleRequired"));
			return;
		}
		if (!composer.trim()) {
			setError(t("screen.addPiece.error.composerRequired"));
			return;
		}

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
			: null;

		setLoading(true);
		setError(null);

		try {
			await addPiece(title.trim(), composer.trim(), state, targetTempoBpm);
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

			<DropdownField
				label={t("screen.addPiece.stateLabel")}
				value={state}
				options={stateOptions}
				onChange={(v) => setState((v as PieceState) ?? "learning")}
			/>

			<TextInput
				label={t("screen.addPiece.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				mode="outlined"
				keyboardType="numeric"
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
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t("screen.addPiece.title")} />
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
