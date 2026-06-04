import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "react-native-paper";
import { ComposerAutocompleteInput } from "@/components/piece/ComposerAutocompleteInput";
import { DropdownField } from "@/components/ui/DropdownField";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAutoFocusOnMount } from "@/hooks/use-auto-focus-on-mount";
import { useAddPiece, usePieces } from "@/hooks/use-pieces";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { PIECE_STATES, type PieceState } from "@/models/piece";
import { validateBpm, validateDuration } from "@/utils/validation";

export default function AddPieceScreen() {
	const { t } = useTranslation();
	const goBack = useUpNavigation("/(app)/(tabs)/piece");
	const { addPiece } = useAddPiece();
	const { pieces } = usePieces();

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

	const handleBpmBlur = () => {
		setBpmError(validateBpm(targetTempoBpmText, t));
	};

	const handleDurationBlur = () => {
		setDurationError(validateDuration(durationMinutesText, t));
	};

	const stateOptions = PIECE_STATES.map((s) => ({
		value: s,
		label: t(`piece.state.${s}`),
	}));

	const handleSave = async () => {
		const titleErr = validateTitle();
		const composerErr = validateComposer();
		const bpmErr = validateBpm(targetTempoBpmText, t);
		setBpmError(bpmErr);
		const durationErr = validateDuration(durationMinutesText, t);
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
			<FormTextField
				ref={titleInputRef}
				label={t("screen.addPiece.titleLabel")}
				value={title}
				onChangeText={(v) => {
					setTitle(v);
					titleTouched.current = true;
				}}
				error={titleError}
				onBlur={() => {
					if (titleTouched.current) validateTitle();
				}}
			/>

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

			<FormTextField
				label={t("screen.addPiece.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				keyboardType="numeric"
				error={bpmError}
				onBlur={handleBpmBlur}
			/>

			<FormTextField
				label={t("screen.addPiece.durationLabel")}
				value={durationMinutesText}
				onChangeText={setDurationMinutesText}
				keyboardType="numeric"
				error={durationError}
				onBlur={handleDurationBlur}
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
		<FormScaffold
			title={t("screen.addPiece.title")}
			onBack={goBack}
			error={error}
			onDismissError={() => setError(null)}
		>
			{formContent}
		</FormScaffold>
	);
}
