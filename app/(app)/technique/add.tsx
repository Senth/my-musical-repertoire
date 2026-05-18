import { useRouter } from "expo-router";
import { useState } from "react";
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
import { useAddTechnique } from "@/hooks/use-techniques";
import {
	TECHNIQUE_STATES,
	TECHNIQUE_TYPES,
	type TechniqueState,
	type TechniqueType,
} from "@/models/technique";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function AddTechniqueScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { addTechnique } = useAddTechnique();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const [title, setTitle] = useState("");
	const [state, setState] = useState<TechniqueState>("active");
	const [type, setType] = useState<TechniqueType | null>(null);
	const [targetTempoBpmText, setTargetTempoBpmText] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [titleError, setTitleError] = useState<string | null>(null);
	const [bpmError, setBpmError] = useState<string | null>(null);

	const validateTitle = (): string | null => {
		const err = !title.trim()
			? t("screen.addTechnique.error.titleRequired")
			: null;
		setTitleError(err);
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
		const bpmErr = validateBpm(targetTempoBpmText);
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
					label={t("screen.addTechnique.titleLabel")}
					value={title}
					onChangeText={setTitle}
					mode="outlined"
					autoFocus
					error={!!titleError}
					onBlur={() => validateTitle()}
				/>
				<HelperText type="error" visible={!!titleError}>
					{titleError ?? ""}
				</HelperText>
			</View>

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

			<View>
				<TextInput
					label={t("screen.addTechnique.targetTempoBpmLabel")}
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
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content title={t("screen.addTechnique.title")} />
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
