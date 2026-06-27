import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { ComposerAutocompleteInput } from "@/components/piece/ComposerAutocompleteInput";
import { DropdownField } from "@/components/ui/DropdownField";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { FormTextField } from "@/components/ui/FormTextField";
import { usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	LEARNING_PHASES,
	type LearningPhase,
	PIECE_STATES,
	type PieceState,
} from "@/models/piece";
import { validateBpm, validateDuration } from "@/utils/validation";

export default function EditPieceScreen() {
	const { t } = useTranslation();
	const { id } = useLocalSearchParams<{ id: string }>();
	const goBack = useUpNavigation(`/piece/${id}`);
	const { pieces } = usePieces();
	const { updatePiece } = useUpdatePiece();

	const piece = pieces.find((p) => p.id === id);

	const [title, setTitle] = useState(piece?.title ?? "");
	const [composer, setComposer] = useState(piece?.composer ?? "");
	const [state, setState] = useState<PieceState>(piece?.state ?? "learning");
	const [learningPhase, setLearningPhase] = useState<LearningPhase | null>(
		piece?.learningPhase ?? null,
	);
	const [targetTempoBpmText, setTargetTempoBpmText] = useState(
		piece?.targetTempoBpm?.toString() ?? "",
	);
	const [durationMinutesText, setDurationMinutesText] = useState(
		piece?.durationSeconds != null
			? String(Math.round(piece.durationSeconds / 60))
			: "",
	);
	const [difficulty, setDifficulty] = useState<string | null>(
		piece?.difficulty?.toString() ?? null,
	);
	const [notes, setNotes] = useState(piece?.notes ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [titleError, setTitleError] = useState<string | null>(null);
	const [composerError, setComposerError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [durationError, setDurationError] = useState<string | null>(null);
	const hasSeeded = useRef(false);

	const validateTitle = (): string | null => {
		const err = !title.trim()
			? t("screen.editPiece.error.titleRequired")
			: null;
		setTitleError(err);
		return err;
	};

	const validateComposer = (): string | null => {
		const err = !composer.trim()
			? t("screen.editPiece.error.composerRequired")
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

	// Seed form once the piece loads from Firestore (avoids resetting user edits on re-renders)
	useEffect(() => {
		if (piece && !hasSeeded.current) {
			setTitle(piece.title);
			setComposer(piece.composer);
			setState(piece.state);
			setLearningPhase(piece.learningPhase ?? null);
			setTargetTempoBpmText(piece.targetTempoBpm?.toString() ?? "");
			setDurationMinutesText(
				piece.durationSeconds != null
					? String(Math.round(piece.durationSeconds / 60))
					: "",
			);
			setDifficulty(piece.difficulty?.toString() ?? null);
			setNotes(piece.notes ?? "");
			hasSeeded.current = true;
		}
	}, [piece]);

	const stateOptions = PIECE_STATES.map((s) => ({
		value: s,
		label: t(`piece.state.${s}`),
	}));

	const learningPhaseOptions = [
		{ value: null, label: t("piece.learningPhase.notTracking") },
		...LEARNING_PHASES.map((p) => ({
			value: p,
			label: t(`piece.learningPhase.${p}`),
		})),
	];

	const difficultyOptions = [
		{ value: null, label: t("piece.difficulty.notSet") },
		...([1, 2, 3, 4, 5] as const).map((d) => ({
			value: String(d),
			label: t(`piece.difficulty.${d}`),
		})),
	];

	const handleSave = async () => {
		const titleErr = validateTitle();
		const composerErr = validateComposer();
		const bpmErr = validateBpm(targetTempoBpmText, t);
		setBpmError(bpmErr);
		const durationErr = validateDuration(durationMinutesText, t);
		setDurationError(durationErr);
		if (titleErr || composerErr || bpmErr || durationErr) return;
		if (!id) return;

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
			: null;

		const durationSeconds = durationMinutesText.trim()
			? Number.parseInt(durationMinutesText.trim(), 10) * 60
			: null;

		const parsedDifficulty = difficulty
			? (Number.parseInt(difficulty, 10) as 1 | 2 | 3 | 4 | 5)
			: null;

		setLoading(true);
		setError(null);

		try {
			await updatePiece(id, {
				title: title.trim(),
				composer: composer.trim(),
				state,
				learningPhase: state === "learning" ? learningPhase : null,
				targetTempoBpm,
				durationSeconds,
				difficulty: parsedDifficulty,
				notes: notes.trim() || null,
			});
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
				label={t("screen.editPiece.titleLabel")}
				value={title}
				onChangeText={setTitle}
				autoFocus
				error={titleError}
				onBlur={() => validateTitle()}
			/>

			<ComposerAutocompleteInput
				label={t("screen.editPiece.composerLabel")}
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
				label={t("screen.editPiece.stateLabel")}
				value={state}
				options={stateOptions}
				onChange={(v) => {
					const next = (v as PieceState) ?? "learning";
					setState(next);
					if (next !== "learning") setLearningPhase(null);
				}}
			/>

			{state === "learning" && (
				<DropdownField
					label={t("screen.editPiece.learningPhaseLabel")}
					value={learningPhase}
					options={learningPhaseOptions}
					onChange={(v) => setLearningPhase((v as LearningPhase) ?? null)}
				/>
			)}

			<FormTextField
				label={t("screen.editPiece.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				keyboardType="numeric"
				error={bpmError}
				onBlur={handleBpmBlur}
			/>

			<FormTextField
				label={t("screen.editPiece.durationLabel")}
				value={durationMinutesText}
				onChangeText={setDurationMinutesText}
				keyboardType="numeric"
				error={durationError}
				onBlur={handleDurationBlur}
			/>

			<DropdownField
				label={t("screen.editPiece.difficultyLabel")}
				value={difficulty}
				options={difficultyOptions}
				onChange={setDifficulty}
			/>

			<TextInput
				label={t("screen.editPiece.notesLabel")}
				value={notes}
				onChangeText={setNotes}
				mode="outlined"
				multiline
				numberOfLines={3}
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
		<FormScaffold
			title={t("screen.editPiece.title")}
			onBack={goBack}
			error={error}
			onDismissError={() => setError(null)}
		>
			{formContent}
		</FormScaffold>
	);
}
