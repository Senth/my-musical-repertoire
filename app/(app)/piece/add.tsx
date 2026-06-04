import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	useWindowDimensions,
	View,
} from "react-native";
import {
	Appbar,
	Button,
	Card,
	HelperText,
	Snackbar,
	TextInput,
	useTheme,
} from "react-native-paper";
import { ComposerAutocompleteInput } from "@/components/piece/ComposerAutocompleteInput";
import { DropdownField } from "@/components/ui/DropdownField";
import { useAutoFocusOnMount } from "@/hooks/use-auto-focus-on-mount";
import { useAddPiece, usePieces } from "@/hooks/use-pieces";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { PIECE_STATES, type PieceState } from "@/models/piece";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function AddPieceScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const goBack = useUpNavigation("/(app)/(tabs)/piece");
	const { addPiece } = useAddPiece();
	const { pieces } = usePieces();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const [title, setTitle] = useState("");
	const [composer, setComposer] = useState("");
	const [state, setState] = useState<PieceState>("learning");
	const [targetTempoBpmText, setTargetTempoBpmText] = useState("");
	const [durationMinutesText, setDurationMinutesText] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [titleError, setTitleError] = useState<string | null>(null);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [durationError, setDurationError] = useState<string | null>(null);
	const titleTouched = useRef(false);
	const titleInputRef = useAutoFocusOnMount();

	const validateTitle = (): string | null => {
		const err = !title.trim() ? t("screen.addPiece.error.titleRequired") : null;
		setTitleError(err);
		return err;
	};

	const validateComposer = (): string | null => {
		const err = !composer.trim()
			? t("screen.addPiece.error.composerRequired")
			: null;
		setComposerError(err);
		return err;
	};

	const validateBpm = (text: string): string | null => {
		if (!text.trim()) return null;
		const n = Number.parseInt(text.trim(), 10);
		return Number.isNaN(n) || n < 20 || n > 240 ? t("error.bpmInvalid") : null;
	};

	const handleBpmBlur = () => {
		setBpmError(validateBpm(targetTempoBpmText));
	};

	const validateDuration = (text: string): string | null => {
		if (!text.trim()) return null;
		const n = Number.parseInt(text.trim(), 10);
		return Number.isNaN(n) || n < 1 || n > 600
			? t("error.durationInvalid")
			: null;
	};

	const handleDurationBlur = () => {
		setDurationError(validateDuration(durationMinutesText));
	};

	const stateOptions = PIECE_STATES.map((s) => ({
		value: s,
		label: t(`piece.state.${s}`),
	}));

	const handleSave = async () => {
		const titleErr = validateTitle();
		const composerErr = validateComposer();
		const bpmErr = validateBpm(targetTempoBpmText);
		setBpmError(bpmErr);
		const durationErr = validateDuration(durationMinutesText);
		setDurationError(durationErr);
		if (titleErr || composerErr || bpmErr || durationErr) return;

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
			: null;

		const durationSeconds = durationMinutesText.trim()
			? Number.parseInt(durationMinutesText.trim(), 10) * 60
			: null;

		setLoading(true);
		setError(null);

		try {
			await addPiece(
				title.trim(),
				composer.trim(),
				state,
				targetTempoBpm,
				durationSeconds,
			);
			goBack();
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	const formContent = (
		<View className="gap-4">
			<View>
				<TextInput
					ref={titleInputRef}
					label={t("screen.addPiece.titleLabel")}
					value={title}
					onChangeText={(v) => {
						setTitle(v);
						titleTouched.current = true;
					}}
					mode="outlined"
					error={!!titleError}
					onBlur={() => {
						if (titleTouched.current) validateTitle();
					}}
				/>
				<HelperText type="error" visible={!!titleError}>
					{titleError ?? ""}
				</HelperText>
			</View>

			<ComposerAutocompleteInput
				label={t("screen.addPiece.composerLabel")}
				value={composer}
				onChangeText={(text) => {
					setComposer(text);
					if (composerError) validateComposer();
				}}
				error={!!composerError}
				helperText={composerError ?? undefined}
				pieces={pieces}
			/>

			<DropdownField
				label={t("screen.addPiece.stateLabel")}
				value={state}
				options={stateOptions}
				onChange={(v) => setState((v as PieceState) ?? "learning")}
			/>

			<View>
				<TextInput
					label={t("screen.addPiece.targetTempoBpmLabel")}
					value={targetTempoBpmText}
					onChangeText={setTargetTempoBpmText}
					mode="outlined"
					keyboardType="numeric"
					error={!!bpmError}
					onBlur={handleBpmBlur}
				/>
				<HelperText type="error" visible={!!bpmError}>
					{bpmError ?? ""}
				</HelperText>
			</View>

			<View>
				<TextInput
					label={t("screen.addPiece.durationLabel")}
					value={durationMinutesText}
					onChangeText={setDurationMinutesText}
					mode="outlined"
					keyboardType="numeric"
					error={!!durationError}
					onBlur={handleDurationBlur}
				/>
				<HelperText type="error" visible={!!durationError}>
					{durationError ?? ""}
				</HelperText>
			</View>

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
				<Appbar.BackAction onPress={goBack} />
				<Appbar.Content title={t("screen.addPiece.title")} />
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
								{formContent}
							</Card.Content>
						</Card>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
