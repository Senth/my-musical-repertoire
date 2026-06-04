import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { DropdownField } from "@/components/ui/DropdownField";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAutoFocusOnMount } from "@/hooks/use-auto-focus-on-mount";
import { useAddTechnique } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueState,
	type TechniqueType,
} from "@/models/technique";
import { validateBpm } from "@/utils/validation";

export default function AddTechniqueScreen() {
	const { t } = useTranslation();
	const goBack = useUpNavigation("/(app)/(tabs)/technique");
	const { addTechnique } = useAddTechnique();

	const [title, setTitle] = useState("");
	const [state, setState] = useState<TechniqueState>("active");
	const [type, setType] = useState<TechniqueType | null>(null);
	const [targetTempoBpmText, setTargetTempoBpmText] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [titleError, setTitleError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);
	const titleTouched = useRef(false);
	const titleInputRef = useAutoFocusOnMount();

	const validateTitle = (): string | null => {
		const err = !title.trim()
			? t("screen.addTechnique.error.titleRequired")
			: null;
		setTitleError(err);
		return err;
	};

	const handleBpmBlur = () => {
		setBpmError(validateBpm(targetTempoBpmText, t));
	};

	const stateOptions = TECHNIQUE_STATES.map((s) => ({
		value: s,
		label: t(`technique.state.${s}`),
	}));

	const typeOptions = [
		{ value: null, label: t("screen.addTechnique.typeNone") },
		...TECHNIQUE_TYPES.map((tp) => ({
			value: tp,
			label: t(`technique.type.${tp}`),
		})),
	];

	const handleSave = async () => {
		const titleErr = validateTitle();
		const bpmErr = validateBpm(targetTempoBpmText, t);
		setBpmError(bpmErr);
		if (titleErr || bpmErr) return;

		const targetTempoBpm = targetTempoBpmText.trim()
			? Number.parseInt(targetTempoBpmText.trim(), 10) || null
			: null;

		setLoading(true);
		setError(null);

		try {
			await addTechnique(title.trim(), {
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
			<FormTextField
				ref={titleInputRef}
				label={t("screen.addTechnique.titleLabel")}
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

			<DropdownField
				label={t("screen.addTechnique.stateLabel")}
				value={state}
				options={stateOptions}
				onChange={(v) => setState((v as TechniqueState) ?? "active")}
			/>

			<DropdownField
				label={t("screen.addTechnique.typeLabel")}
				value={type}
				options={typeOptions}
				onChange={(v) => setType((v as TechniqueType) ?? null)}
			/>

			<FormTextField
				label={t("screen.addTechnique.targetTempoBpmLabel")}
				value={targetTempoBpmText}
				onChangeText={setTargetTempoBpmText}
				keyboardType="numeric"
				error={bpmError}
				onBlur={handleBpmBlur}
			/>

			<TextInput
				label={t("screen.addTechnique.notesLabel")}
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
				{t("screen.addTechnique.save")}
			</Button>
		</View>
	);

	return (
		<FormScaffold
			title={t("screen.addTechnique.title")}
			onBack={goBack}
			error={error}
			onDismissError={() => setError(null)}
		>
			{formContent}
		</FormScaffold>
	);
}
