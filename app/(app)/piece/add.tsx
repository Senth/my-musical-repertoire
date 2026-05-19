import { useRouter } from "expo-router";
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
import { DropdownField } from "@/components/ui/DropdownField";
import { useAutoFocusOnMount } from "@/hooks/use-auto-focus-on-mount";
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
	const [titleError, setTitleError] = useState<string | null>(null);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const titleTouched = useRef(false);
	const titleInputRef = useAutoFocusOnMount<{ focus: () => void }>();

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

	const stateOptions = PIECE_STATES.map((s) => ({
		value: s,
		label: t(`piece.state.${s}`),
	}));

	const handleSave = async () => {
		const titleErr = validateTitle();
		const composerErr = validateComposer();
		const bpmErr = validateBpm(targetTempoBpmText);
		setBpmError(bpmErr);
		if (titleErr || composerErr || bpmErr) return;

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
				/>
				<HelperText type="error" visible={!!titleError}>
					{titleError ?? ""}
				</HelperText>
			</View>

			<View>
				<TextInput
					label={t("screen.addPiece.composerLabel")}
					value={composer}
					onChangeText={setComposer}
					mode="outlined"
					error={!!composerError}
					onBlur={() => validateComposer()}
				/>
				<HelperText type="error" visible={!!composerError}>
					{composerError ?? ""}
				</HelperText>
			</View>

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
