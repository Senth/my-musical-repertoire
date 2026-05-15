import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
	Button,
	Modal,
	Portal,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { DropdownField } from "@/components/ui/DropdownField";
import type { Section, SectionPhase } from "@/models/section";
import { SECTION_PHASES } from "@/models/section";

interface SectionFormModalProps {
	visible: boolean;
	onDismiss: () => void;
	onSave: (
		data: Omit<
			Section,
			"id" | "pieceId" | "userId" | "archived" | "createdAt" | "order"
		>,
	) => Promise<void>;
	initialValues?: Section | null;
	pieceTargetBpm?: number | null;
}

export function SectionFormModal({
	visible,
	onDismiss,
	onSave,
	initialValues,
	pieceTargetBpm,
}: SectionFormModalProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const [label, setLabel] = useState(initialValues?.label ?? "");
	const [phase, setPhase] = useState<SectionPhase>(
		initialValues?.phase ?? "learning",
	);
	const [startBarText, setStartBarText] = useState(
		initialValues?.startBar?.toString() ?? "",
	);
	const [endBarText, setEndBarText] = useState(
		initialValues?.endBar?.toString() ?? "",
	);
	const [currentBpmText, setCurrentBpmText] = useState(
		initialValues?.currentBpm?.toString() ?? "",
	);
	const [targetBpmOverrideText, setTargetBpmOverrideText] = useState(
		initialValues?.targetBpmOverride?.toString() ?? "",
	);
	const [notes, setNotes] = useState(initialValues?.notes ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset form when modal opens with new values
	const resetForm = () => {
		setLabel(initialValues?.label ?? "");
		setPhase(initialValues?.phase ?? "learning");
		setStartBarText(initialValues?.startBar?.toString() ?? "");
		setEndBarText(initialValues?.endBar?.toString() ?? "");
		setCurrentBpmText(initialValues?.currentBpm?.toString() ?? "");
		setTargetBpmOverrideText(
			initialValues?.targetBpmOverride?.toString() ?? "",
		);
		setNotes(initialValues?.notes ?? "");
		setError(null);
	};

	const handleDismiss = () => {
		resetForm();
		onDismiss();
	};

	const parseOptionalInt = (text: string): number | null => {
		const trimmed = text.trim();
		if (!trimmed) return null;
		const parsed = Number.parseInt(trimmed, 10);
		return Number.isNaN(parsed) ? null : parsed;
	};

	const handleSave = async () => {
		if (!label.trim()) {
			setError(t("screen.pieceSections.form.error.labelRequired"));
			return;
		}

		const startBar = parseOptionalInt(startBarText);
		const endBar = parseOptionalInt(endBarText);

		if (endBar != null && startBar == null) {
			setError(t("screen.pieceSections.form.error.endBarRequiresStartBar"));
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await onSave({
				label: label.trim(),
				phase,
				startBar,
				endBar,
				currentBpm: parseOptionalInt(currentBpmText),
				targetBpmOverride: parseOptionalInt(targetBpmOverrideText),
				notes: notes.trim() || null,
			});
			handleDismiss();
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

	const targetBpmPlaceholder = pieceTargetBpm
		? t("screen.pieceSections.targetBpmPlaceholder", { bpm: pieceTargetBpm })
		: t("screen.pieceSections.targetBpmPlaceholderNone");

	const startBar = parseOptionalInt(startBarText);

	return (
		<Portal>
			<Modal
				visible={visible}
				onDismiss={handleDismiss}
				contentContainerStyle={{
					backgroundColor: theme.colors.surface,
					margin: 16,
					borderRadius: 12,
					padding: 24,
					maxHeight: "90%",
				}}
			>
				<ScrollView showsVerticalScrollIndicator={false}>
					<Text
						variant="titleLarge"
						className="mb-4"
						style={{ color: theme.colors.onSurface }}
					>
						{initialValues
							? t("screen.pieceSections.editSection")
							: t("screen.pieceSections.addSection")}
					</Text>

					<View className="gap-4">
						<TextInput
							label={t("screen.pieceSections.form.labelLabel")}
							value={label}
							onChangeText={setLabel}
							mode="outlined"
							autoFocus
						/>

						<DropdownField
							label={t("screen.pieceSections.form.phaseLabel")}
							value={phase}
							options={phaseOptions}
							onChange={(v) => setPhase((v as SectionPhase) ?? "learning")}
						/>

						<TextInput
							label={t("screen.pieceSections.form.startBarLabel")}
							value={startBarText}
							onChangeText={setStartBarText}
							mode="outlined"
							keyboardType="numeric"
						/>

						{startBar != null && (
							<TextInput
								label={t("screen.pieceSections.form.endBarLabel")}
								value={endBarText}
								onChangeText={setEndBarText}
								mode="outlined"
								keyboardType="numeric"
							/>
						)}

						<TextInput
							label={t("screen.pieceSections.form.currentBpmLabel")}
							value={currentBpmText}
							onChangeText={setCurrentBpmText}
							mode="outlined"
							keyboardType="numeric"
						/>

						<TextInput
							label={t("screen.pieceSections.form.targetBpmOverrideLabel")}
							value={targetBpmOverrideText}
							onChangeText={setTargetBpmOverrideText}
							mode="outlined"
							keyboardType="numeric"
							placeholder={targetBpmPlaceholder}
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

						<View className="flex-row gap-2 justify-end">
							<Button onPress={handleDismiss} disabled={loading}>
								{t("screen.pieceSections.archiveDialog.cancel")}
							</Button>
							<Button
								mode="contained"
								onPress={handleSave}
								loading={loading}
								disabled={loading}
							>
								{t("screen.pieceSections.form.save")}
							</Button>
						</View>
					</View>
				</ScrollView>
			</Modal>
		</Portal>
	);
}
