import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon, Text, TextInput, useTheme } from "react-native-paper";

interface StandingNoteProps {
	/** The entity's standing note (`Section.notes` / `Piece.notes` / `Technique.notes`). */
	value: string | null | undefined;
	onSave: (text: string | null) => void;
}

/**
 * The standing note: always on screen, edited in place through the pencil.
 * This is where the teacher's "where we were last time" lives now — the per-log
 * note is gone, so the note attaches to the passage, not to a save.
 */
export function StandingNote({ value, onSave }: StandingNoteProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value ?? "");

	const commit = () => {
		setEditing(false);
		const trimmed = draft.trim();
		if (trimmed === (value ?? "")) return;
		onSave(trimmed || null);
	};

	return (
		<View style={{ gap: 8 }}>
			<View style={{ flexDirection: "row", alignItems: "center" }}>
				<Text variant="labelLarge">
					{t("screen.practice.standingNote.heading")}
				</Text>
				<Pressable
					onPress={() => {
						setDraft(value ?? "");
						setEditing(true);
					}}
					accessibilityRole="button"
					accessibilityLabel={t("screen.practice.standingNote.editA11y")}
					style={{ marginLeft: "auto", padding: 4 }}
				>
					<Icon
						source="pencil"
						size={18}
						color={theme.colors.onSurfaceVariant}
					/>
				</Pressable>
			</View>
			{editing ? (
				<TextInput
					mode="flat"
					value={draft}
					onChangeText={setDraft}
					multiline
					autoFocus
					onBlur={commit}
					placeholder={t("screen.practice.standingNote.placeholder")}
					accessibilityLabel={t("screen.practice.standingNote.editA11y")}
				/>
			) : (
				value && (
					// Italic marks the note as a quotation — it is the student's
					// own words to their future self.
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurface, fontStyle: "italic" }}
					>
						{value}
					</Text>
				)
			)}
		</View>
	);
}
