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
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { DropdownField } from "@/components/ui/DropdownField";
import { usePieces } from "@/hooks/use-pieces";
import {
	useAddSection,
	useSections,
	useUpdateSection,
} from "@/hooks/use-sections";
import { SECTION_PHASES, type SectionPhase } from "@/models/section";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function SectionEditScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { id: pieceId, sectionId } = useLocalSearchParams<{
		id: string;
		sectionId: string;
	}>();
	const isNew = sectionId === "new";
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const { pieces } = usePieces();
	const piece = pieces.find((p) => p.id === pieceId);
	const { sections } = useSections(pieceId ?? "");
	const section = isNew
		? null
		: (sections.find((s) => s.id === sectionId) ?? null);

	const { addSection } = useAddSection();
	const { updateSection } = useUpdateSection();

	const [label, setLabel] = useState("");
	const [phase, setPhase] = useState<SectionPhase>("learning");
	const [startBarText, setStartBarText] = useState("");
	const [endBarText, setEndBarText] = useState("");
	const [currentBpmText, setCurrentBpmText] = useState("");
	const [notes, setNotes] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasSeeded = useRef(false);

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
			router.back();
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
			<TextInput
				label={t("screen.pieceSections.form.labelLabel")}
				value={label}
				onChangeText={setLabel}
				mode="outlined"
				autoFocus={isNew}
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
					/>
				</View>
			</View>

			<TextInput
				label={t("screen.pieceSections.form.currentBpmLabel")}
				value={currentBpmText}
				onChangeText={setCurrentBpmText}
				mode="outlined"
				keyboardType="numeric"
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
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={() => router.back()} />
				<Appbar.Content
					title={
						isNew
							? t("screen.pieceSections.addSection")
							: t("screen.pieceSections.editSection")
					}
					subtitle={piece ? `${piece.composer} — ${piece.title}` : undefined}
				/>
			</Appbar.Header>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1"
				style={{
					paddingHorizontal: isCompact ? 16 : 24,
					paddingTop: 24,
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
			</KeyboardAvoidingView>

			<Snackbar
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: "OK", onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
