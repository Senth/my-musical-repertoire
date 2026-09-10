import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import type {
	TimeSignature,
	TimeSignatureWritePlan,
} from "@/utils/time-signature";
import { formatTimeSignature } from "@/utils/time-signature";
import { AccentSheet } from "./AccentSheet";

interface AccentChipProps {
	accentOn: boolean;
	signature: TimeSignature | null;
	onToggleAccent: () => void;
	planFor: (next: TimeSignature) => TimeSignatureWritePlan;
	onChange: (next: TimeSignature) => void;
	onClear: () => void;
}

const CHIP_HEIGHT = 40;

/**
 * Split chip: the left half toggles the accent, the chevron opens the sheet.
 * Tinted while the accent sounds, outlined while silent — the chip reads back
 * its own state instead of costing the signature row a permanent slot.
 */
export function AccentChip({
	accentOn,
	signature,
	onToggleAccent,
	planFor,
	onChange,
	onClear,
}: AccentChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [sheetOpen, setSheetOpen] = useState(false);

	const sounding = accentOn && signature != null;
	const tint = sounding
		? theme.colors.onSecondaryContainer
		: theme.colors.onSurfaceVariant;

	return (
		<View>
			{/* r8's `.split`: one 40px pill, radius 20, visibly two halves with a
			    divider between them — tinted while sounding, outlined when silent. */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					height: CHIP_HEIGHT,
					borderRadius: 20,
					borderWidth: sounding ? 0 : 1,
					borderColor: theme.colors.outline,
					backgroundColor: sounding
						? theme.colors.secondaryContainer
						: "transparent",
					overflow: "hidden",
				}}
			>
				<Pressable
					onPress={onToggleAccent}
					accessibilityRole="button"
					accessibilityLabel={t("common.metronome.accent.toggleA11y")}
					accessibilityState={{ selected: sounding }}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 5,
						height: CHIP_HEIGHT,
						paddingLeft: 12,
					}}
				>
					<Icon
						source={sounding ? "music-note" : "close"}
						size={16}
						color={tint}
					/>
					<Text variant="labelLarge" style={{ color: tint }}>
						{sounding && signature
							? formatTimeSignature(signature)
							: t("common.metronome.accent.off")}
					</Text>
				</Pressable>
				<Pressable
					onPress={() => setSheetOpen(true)}
					accessibilityRole="button"
					accessibilityLabel={t("common.metronome.accent.editA11y")}
					style={{
						height: CHIP_HEIGHT,
						justifyContent: "center",
						paddingHorizontal: 9,
						borderLeftWidth: 1,
						borderLeftColor: sounding
							? theme.colors.outline
							: theme.colors.outlineVariant,
					}}
				>
					<Icon source="chevron-down" size={18} color={tint} />
				</Pressable>
			</View>
			<AccentSheet
				visible={sheetOpen}
				onDismiss={() => setSheetOpen(false)}
				signature={signature}
				planFor={planFor}
				onChange={onChange}
				onClear={onClear}
			/>
		</View>
	);
}
