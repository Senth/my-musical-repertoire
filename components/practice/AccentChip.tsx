import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import { border, icon, radius, size, space, touchTarget } from "@/theme/tokens";
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
			{/* r8's `.split`: one pill as tall as the outlined Paper buttons beside
			    it, visibly two halves with a divider between them — tinted while
			    sounding, outlined when silent. */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					borderRadius: radius.full,
					borderWidth: border.hairline,
					borderColor: sounding
						? theme.colors.secondaryContainer
						: theme.colors.outline,
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
						gap: space.xs,
						height: size.control,
						paddingLeft: space.md,
						paddingRight: space.md,
					}}
				>
					<Icon
						source={sounding ? "music-note" : "close"}
						size={icon.sm}
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
						height: size.control,
						minWidth: touchTarget.minimum,
						alignItems: "center",
						justifyContent: "center",
						paddingHorizontal: space.sm,
						borderLeftWidth: border.hairline,
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
