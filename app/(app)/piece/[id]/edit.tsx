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
import { DropdownField } from "@/components/ui/DropdownField";
import { usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import {
	LEARNING_PHASES,
	type LearningPhase,
	PIECE_STATES,
	type PieceState,
} from "@/models/piece";

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
	const [state, setState] = useState<PieceState>(piece?.state ?? "learning");
	const [learningPhase, setLearningPhase] = useState<LearningPhase | null>(
		piece?.learningPhase ?? null,
	);
	const [targetTempoBpmText, setTargetTempoBpmText] = useState(
		piece?.targetTempoBpm?.toString() ?? "",
	);
	const [difficulty, setDifficulty] = useState<string | null>(
		piece?.difficulty?.toString() ?? null,
	);
	const [notes, setNotes] = useState(piece?.notes ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasSeeded = useRef(false);

	// Seed form once the piece loads from Firestore (avoids resetting user edits on re-renders)
	useEffect(() => {
		if (piece && !hasSeeded.current) {
			setTitle(piece.title);
			setComposer(piece.composer);
			setState(piece.state);
			setLearningPhase(piece.learningPhase ?? null);
			setTargetTempoBpmText(piece.targetTempoBpm?.toString() ?? "");
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
		if (!title.trim()) {
			setError(t("screen.editPiece.error.titleRequired"));
			return;
		}
		if (!composer.trim()) {
			setError(t("screen.editPiece.error.composerRequired"));
			return;
		}
		if (!id) return;

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
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
				difficulty: parsedDifficulty,
				notes: notes.trim() || null,
			});
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

			<TextInput
				label={t("screen.editPiece.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				mode="outlined"
				keyboardType="numeric"
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
				action={{ label: t("common.ok"), onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
