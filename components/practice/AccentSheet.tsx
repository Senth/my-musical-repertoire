import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import {
	Button,
	Chip,
	Divider,
	Modal,
	Portal,
	SegmentedButtons,
	Text,
	useTheme,
} from "react-native-paper";
import { useIsCompact } from "@/hooks/use-is-compact";
import {
	formatTimeSignature,
	NOTE_VALUES,
	type NoteValue,
	PRESETS,
	type TimeSignature,
	type TimeSignatureWritePlan,
} from "@/utils/time-signature";

const LANDING_KEYS = {
	piece: "landsPiece",
	section: "landsSection",
	technique: "landsTechnique",
	none: "landsNone",
} as const;

interface AccentSheetProps {
	visible: boolean;
	onDismiss: () => void;
	signature: TimeSignature | null;
	planFor: (next: TimeSignature) => TimeSignatureWritePlan;
	onChange: (next: TimeSignature) => void;
	onClear: () => void;
}

function sameSig(a: TimeSignature, b: TimeSignature): boolean {
	return formatTimeSignature(a) === formatTimeSignature(b);
}

/**
 * Where the bar starts, as stored data: presets plus a custom editor, with a
 * line at the bottom naming where the write lands. Every tap applies at once —
 * there is no draft and no Apply to get wrong.
 */
export function AccentSheet({
	visible,
	onDismiss,
	signature,
	planFor,
	onChange,
	onClear,
}: AccentSheetProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const isCompact = useIsCompact();
	const [editing, setEditing] = useState(false);
	const [beats, setBeats] = useState(4);
	const [noteValue, setNoteValue] = useState<NoteValue>(4);

	const close = () => {
		setEditing(false);
		onDismiss();
	};

	const openEditor = () => {
		setBeats(signature?.beats ?? 4);
		setNoteValue(signature?.noteValue ?? 4);
		setEditing(true);
	};

	const adjustBeats = (delta: number) => {
		const next = Math.max(1, beats + delta);
		setBeats(next);
		onChange({ beats: next, noteValue });
	};

	const pickNoteValue = (value: NoteValue) => {
		setNoteValue(value);
		onChange({ beats, noteValue: value });
	};

	const pending: TimeSignature = editing
		? { beats, noteValue }
		: (signature ?? { beats: 4, noteValue: 4 });
	const landing = planFor(pending);
	const isCustom =
		signature != null && !PRESETS.some((preset) => sameSig(preset, signature));

	return (
		<Portal>
			<Modal
				visible={visible}
				onDismiss={close}
				style={isCompact ? { justifyContent: "flex-end" } : undefined}
				contentContainerStyle={{
					backgroundColor: theme.colors.elevation.level3,
					marginHorizontal: isCompact ? 0 : 24,
					alignSelf: "center",
					width: "100%",
					maxWidth: isCompact ? undefined : 480,
					maxHeight: "80%",
					borderTopLeftRadius: 28,
					borderTopRightRadius: 28,
					borderBottomLeftRadius: isCompact ? 0 : 28,
					borderBottomRightRadius: isCompact ? 0 : 28,
					overflow: "hidden",
				}}
			>
				<View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
					<Text variant="titleLarge">{t("common.metronome.accent.title")}</Text>
				</View>

				<ScrollView
					contentContainerStyle={{
						paddingHorizontal: 24,
						paddingVertical: 16,
						gap: 20,
					}}
				>
					{editing ? (
						<>
							<View style={{ gap: 8 }}>
								<Text
									variant="labelLarge"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("common.metronome.accent.beats")}
								</Text>
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										justifyContent: "center",
										gap: 12,
									}}
								>
									<SegmentedButtons
										value=""
										onValueChange={(v) => adjustBeats(v === "minus5" ? -5 : -1)}
										buttons={[
											{
												value: "minus5",
												icon: "chevron-double-left",
												accessibilityLabel: t("common.bpm.decreaseFive"),
												disabled: beats <= 1,
											},
											{
												value: "minus1",
												icon: "chevron-left",
												accessibilityLabel: t("common.bpm.decreaseOne"),
												disabled: beats <= 1,
											},
										]}
									/>
									<Text variant="headlineSmall">{beats}</Text>
									<SegmentedButtons
										value=""
										onValueChange={(v) => adjustBeats(v === "plus5" ? 5 : 1)}
										buttons={[
											{
												value: "plus1",
												icon: "chevron-right",
												accessibilityLabel: t("common.bpm.increaseOne"),
											},
											{
												value: "plus5",
												icon: "chevron-double-right",
												accessibilityLabel: t("common.bpm.increaseFive"),
											},
										]}
									/>
								</View>
							</View>
							<View style={{ gap: 8 }}>
								<Text
									variant="labelLarge"
									style={{ color: theme.colors.onSurfaceVariant }}
								>
									{t("common.metronome.accent.noteValue")}
								</Text>
								<View
									style={{
										flexDirection: "row",
										flexWrap: "wrap",
										gap: 8,
									}}
								>
									{NOTE_VALUES.map((value) => (
										<Chip
											key={value}
											compact
											showSelectedCheck
											selected={noteValue === value}
											onPress={() => pickNoteValue(value)}
										>
											{value}
										</Chip>
									))}
								</View>
							</View>
						</>
					) : (
						<View
							style={{
								flexDirection: "row",
								flexWrap: "wrap",
								gap: 8,
							}}
						>
							<Chip
								compact
								showSelectedCheck
								selected={signature == null}
								onPress={onClear}
							>
								{t("common.metronome.accent.none")}
							</Chip>
							{PRESETS.map((preset) => (
								<Chip
									key={formatTimeSignature(preset)}
									compact
									showSelectedCheck
									selected={signature != null && sameSig(preset, signature)}
									onPress={() => onChange(preset)}
								>
									{formatTimeSignature(preset)}
								</Chip>
							))}
							<Chip
								compact
								icon="pencil"
								selected={isCustom}
								showSelectedCheck={isCustom}
								onPress={openEditor}
							>
								{isCustom && signature
									? formatTimeSignature(signature)
									: t("common.metronome.accent.custom")}
							</Chip>
						</View>
					)}
				</ScrollView>

				<Divider />
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 12,
						paddingHorizontal: 16,
						paddingVertical: 12,
					}}
				>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
					>
						{t(
							`common.metronome.accent.${LANDING_KEYS[landing.target]}` as const,
						)}
					</Text>
					<Button mode="contained" onPress={close}>
						{t("common.done")}
					</Button>
				</View>
			</Modal>
		</Portal>
	);
}
