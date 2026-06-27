import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { DropdownField } from "@/components/ui/DropdownField";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { useTechniques, useUpdateTechnique } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueState,
	type TechniqueType,
} from "@/models/technique";

export default function EditTechniqueScreen() {
	const { t } = useTranslation();
	const { id } = useLocalSearchParams<{ id: string }>();
	const goBack = useUpNavigation(`/technique/${id}`);
	const { techniques } = useTechniques();
	const { updateTechnique } = useUpdateTechnique();

	const item = techniques.find((tech) => tech.id === id);

	const [title, setTitle] = useState(item?.title ?? "");
	const [state, setState] = useState<TechniqueState>(item?.state ?? "active");
	const [type, setType] = useState<TechniqueType | null>(item?.type ?? null);
	const [targetTempoBpmText, setTargetTempoBpmText] = useState(
		item?.targetTempoBpm?.toString() ?? "",
	);
	const [notes, setNotes] = useState(item?.notes ?? "");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasSeeded = useRef(false);

	// Seed form once the item loads from Firestore (avoids resetting user edits on re-renders)
	useEffect(() => {
		if (item && !hasSeeded.current) {
			setTitle(item.title);
			setState(item.state);
			setType(item.type ?? null);
			setTargetTempoBpmText(item.targetTempoBpm?.toString() ?? "");
			setNotes(item.notes ?? "");
			hasSeeded.current = true;
		}
	}, [item]);

	const stateOptions = TECHNIQUE_STATES.map((s) => ({
		value: s,
		label: t(`technique.state.${s}`),
	}));

	const typeOptions = [
		{ value: null, label: t("screen.editTechnique.typeNone") },
		...TECHNIQUE_TYPES.map((tp) => ({
			value: tp,
			label: t(`technique.type.${tp}`),
		})),
	];

	const handleSave = async () => {
		if (!title.trim()) {
			setError(t("screen.editTechnique.error.titleRequired"));
			return;
		}
		if (!id) return;

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
			: null;

		setLoading(true);
		setError(null);

		try {
			await updateTechnique(id, {
				title: title.trim(),
				state,
				type,
				targetTempoBpm,
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
			<TextInput
				label={t("screen.editTechnique.titleLabel")}
				value={title}
				onChangeText={setTitle}
				mode="outlined"
				autoFocus
			/>

			<DropdownField
				label={t("screen.editTechnique.stateLabel")}
				value={state}
				options={stateOptions}
				onChange={(v) => setState((v as TechniqueState) ?? "active")}
			/>

			<DropdownField
				label={t("screen.editTechnique.typeLabel")}
				value={type}
				options={typeOptions}
				onChange={(v) => setType((v as TechniqueType) ?? null)}
			/>

			<TextInput
				label={t("screen.editTechnique.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				mode="outlined"
				keyboardType="numeric"
			/>

			<TextInput
				label={t("screen.editTechnique.notesLabel")}
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
				{t("screen.editTechnique.save")}
			</Button>
		</View>
	);

	return (
		<FormScaffold
			title={t("screen.editTechnique.title")}
			onBack={goBack}
			error={error}
			onDismissError={() => setError(null)}
		>
			{formContent}
		</FormScaffold>
	);
}
