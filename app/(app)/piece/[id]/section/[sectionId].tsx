import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Button,
	Dialog,
	HelperText,
	Portal,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { DropdownField } from "@/components/ui/DropdownField";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAutoFocusOnMount } from "@/hooks/use-auto-focus-on-mount";
import { usePieces } from "@/hooks/use-pieces";
import {
	useAddSection,
	useArchiveSection,
	useSections,
	useUpdateSection,
} from "@/hooks/use-sections";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { SECTION_PHASES, type SectionPhase } from "@/models/section";
import { validateBpm } from "@/utils/validation";

export default function SectionEditScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const { id: pieceId, sectionId } = useLocalSearchParams<{
		id: string;
		sectionId: string;
	}>();
	const isNew = sectionId === "new";
	const goBack = useUpNavigation(`/piece/${pieceId}`);

	const { pieces } = usePieces();
	const piece = pieces.find((p) => p.id === pieceId);
	const { sections } = useSections(pieceId ?? "");
	const section = isNew
		? null
		: (sections.find((s) => s.id === sectionId) ?? null);

	const { addSection } = useAddSection();
	const { updateSection } = useUpdateSection();
	const { archiveSection } = useArchiveSection();

	const [label, setLabel] = useState("");
	const [phase, setPhase] = useState<SectionPhase>("learning");
	const [startBarText, setStartBarText] = useState("");
	const [endBarText, setEndBarText] = useState("");
	const [currentBpmText, setCurrentBpmText] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [labelError, setLabelError] = useState<string | null>(null);
	const [endBarError, setEndBarError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const [archiveDialogVisible, setArchiveDialogVisible] = useState(false);
	const [archiveLoading, setArchiveLoading] = useState(false);
	const hasSeeded = useRef(false);
	const labelTouched = useRef(false);
	const labelInputRef = useAutoFocusOnMount(isNew);

	const validateLabel = (): string | null => {
		const err = !label.trim()
			? t("screen.pieceSections.form.error.labelRequired")
			: null;
		setLabelError(err);
		return err;
	};

	const validateEndBar = (): string | null => {
		const startTrim = startBarText.trim();
		const endTrim = endBarText.trim();
		const err =
			endTrim && !startTrim
				? t("screen.pieceSections.form.error.endBarRequiresStartBar")
				: null;
		setEndBarError(err);
		return err;
	};

	const handleBpmBlur = () => {
		setBpmError(validateBpm(currentBpmText, t));
	};

	// Seed form once when editing an existing section and data arrives from Firestore
	useEffect(() => {
		if (isNew || hasSeeded.current || !section) return;
		setLabel(section.label);
		setPhase(section.phase);
		setStartBarText(section.startBar?.toString() ?? "");
		setEndBarText(section.endBar?.toString() ?? "");
		setCurrentBpmText(section.currentBpm?.toString() ?? "");
		setNotes(section.notes ?? "");
		hasSeeded.current = true;
	}, [isNew, section]);

	const parseOptionalInt = (text: string): number | null => {
		const trimmed = text.trim();
		if (!trimmed) return null;
		const parsed = Number.parseInt(trimmed, 10);
		return Number.isNaN(parsed) ? null : parsed;
	};

	const handleSave = async () => {
		const labelErr = validateLabel();
		const endBarErr = validateEndBar();
		const bpmErr = validateBpm(currentBpmText, t);
		setBpmError(bpmErr);
		if (labelErr || endBarErr || bpmErr) return;

		const startBar = parseOptionalInt(startBarText);
		const endBar = parseOptionalInt(endBarText);

		if (!pieceId) return;

		setLoading(true);
		setError(null);

		try {
			const sectionData = {
				label: label.trim(),
				phase,
				startBar,
				endBar,
				currentBpm: parseOptionalInt(currentBpmText),
				targetBpmOverride: null as number | null,
				notes: notes.trim() || null,
			};

			if (isNew) {
				await addSection(pieceId, sectionData);
			} else if (sectionId) {
				await updateSection(pieceId, sectionId, sectionData);
			}
			goBack();
		} catch {
			setError(t("error.firebase"));
		} finally {
			setLoading(false);
		}
	};

	const phaseOptions = SECTION_PHASES.map((p) => ({
		value: p,
		label: t(`section.phase.${p}`),
	}));

	const formContent = (
		<View className="gap-4">
			<FormTextField
				ref={labelInputRef}
				label={t("screen.pieceSections.form.labelLabel")}
				value={label}
				onChangeText={(v) => {
					setLabel(v);
					labelTouched.current = true;
				}}
				error={labelError}
				onBlur={() => {
					if (labelTouched.current) validateLabel();
				}}
			/>

			<DropdownField
				label={t("screen.pieceSections.form.phaseLabel")}
				value={phase}
				options={phaseOptions}
				onChange={(v) => setPhase((v as SectionPhase) ?? "learning")}
			/>

			<View className="gap-1">
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.pieceSections.form.barsLabel")}
				</Text>
				<View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
					<TextInput
						style={{ flex: 1 }}
						label={t("screen.pieceSections.form.startBarLabel")}
						value={startBarText}
						onChangeText={setStartBarText}
						mode="outlined"
						keyboardType="numeric"
						onBlur={() => validateEndBar()}
					/>
					<Text
						variant="bodyLarge"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						–
					</Text>
					<TextInput
						style={{ flex: 1 }}
						label={t("screen.pieceSections.form.endBarLabel")}
						value={endBarText}
						onChangeText={setEndBarText}
						mode="outlined"
						keyboardType="numeric"
						error={!!endBarError}
						onBlur={() => validateEndBar()}
					/>
				</View>
				<HelperText type="error" visible={!!endBarError}>
					{endBarError ?? ""}
				</HelperText>
			</View>

			<FormTextField
				label={t("screen.pieceSections.form.currentBpmLabel")}
				value={currentBpmText}
				onChangeText={setCurrentBpmText}
				keyboardType="numeric"
				error={bpmError}
				onBlur={handleBpmBlur}
			/>

			<TextInput
				label={t("screen.pieceSections.form.notesLabel")}
				value={notes}
				onChangeText={setNotes}
				mode="outlined"
				multiline
				numberOfLines={3}
			/>

			{error ? (
				<Text style={{ color: theme.colors.error }}>{error}</Text>
			) : null}

			<Button
				mode="contained"
				onPress={handleSave}
				loading={loading}
				disabled={loading}
			>
				{t("screen.pieceSections.form.save")}
			</Button>

			{!isNew && (
				<Button
					mode="outlined"
					textColor={theme.colors.error}
					style={{ borderColor: theme.colors.error }}
					onPress={() => setArchiveDialogVisible(true)}
					disabled={archiveLoading}
				>
					{t("screen.pieceSections.archiveDialog.confirm")}
				</Button>
			)}
		</View>
	);

	const handleArchiveConfirm = async () => {
		if (!pieceId || !sectionId || isNew) return;
		setArchiveLoading(true);
		try {
			await archiveSection(pieceId, sectionId);
			setArchiveDialogVisible(false);
			goBack();
		} catch {
			setArchiveDialogVisible(false);
			setError(t("error.deleteSection"));
		} finally {
			setArchiveLoading(false);
		}
	};

	return (
		<>
			<FormScaffold
				title={
					isNew
						? t("screen.pieceSections.addSection")
						: t("screen.pieceSections.editSection")
				}
				subtitle={piece ? `${piece.composer} — ${piece.title}` : undefined}
				onBack={goBack}
				error={error}
				onDismissError={() => setError(null)}
			>
				{formContent}
			</FormScaffold>

			<Portal>
				<Dialog
					visible={archiveDialogVisible}
					onDismiss={() => setArchiveDialogVisible(false)}
				>
					<Dialog.Title>
						{t("screen.pieceSections.archiveDialog.title")}
					</Dialog.Title>
					<Dialog.Content>
						<Text>
							{t("screen.pieceSections.archiveDialog.message", {
								name: section?.label ?? "",
							})}
						</Text>
					</Dialog.Content>
					<Dialog.Actions>
						<Button
							onPress={() => setArchiveDialogVisible(false)}
							disabled={archiveLoading}
						>
							{t("screen.pieceSections.archiveDialog.cancel")}
						</Button>
						<Button
							onPress={handleArchiveConfirm}
							loading={archiveLoading}
							disabled={archiveLoading}
							textColor={theme.colors.error}
						>
							{t("screen.pieceSections.archiveDialog.confirm")}
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</>
	);
}
