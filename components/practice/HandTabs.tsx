import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import type { ModeDraft } from "@/hooks/use-mode-drafts";
import type { HandsMode, ModeKey, PracticeDrill } from "@/models/practice";
import { border, space } from "@/theme/tokens";
import { parseModeKey } from "@/utils/practice-modes";

const HANDS_ICON: Record<HandsMode, string> = {
	LH: "hand-back-left",
	RH: "hand-back-right",
	HT: "hand-clap",
};

const TAB_HEIGHT = 40;

interface HandTabsProps {
	available: HandsMode[];
	hands: HandsMode;
	onChangeHands: (hands: HandsMode) => void;
	/** One draft per mode key, as held by `useModeDrafts`. */
	drafts: Record<ModeKey, ModeDraft>;
	/** The active drills, so a hands tab knows which of its drafts count. */
	drills: PracticeDrill[];
}

/**
 * The hand tabs, each with its icon and a check once that hand holds a
 * complete draft. What the save will contain and the lifecycle chip live in
 * `PracticeMeta` beside it.
 */
export function HandTabs({
	available,
	hands,
	onChangeHands,
	drafts,
	drills,
}: HandTabsProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	if (available.length <= 1) return null;

	return (
		<View
			style={{
				flexDirection: "row",
				height: TAB_HEIGHT,
				borderRadius: TAB_HEIGHT / 2,
				borderWidth: border.hairline,
				borderColor: theme.colors.outlineVariant,
				overflow: "hidden",
			}}
		>
			{available.map((h, i) => {
				const selected = h === hands;
				const saved = Object.keys(drafts).some((key) => {
					const parsed = parseModeKey(key);
					return (
						parsed.hands === h &&
						(parsed.drill === null || drills.includes(parsed.drill)) &&
						drafts[key].quality != null &&
						drafts[key].effort != null
					);
				});
				const tint = selected
					? theme.colors.onSecondaryContainer
					: theme.colors.onSurface;
				return (
					<Pressable
						key={h}
						onPress={() => onChangeHands(h)}
						accessibilityRole="button"
						accessibilityLabel={t("screen.practice.modes.a11ySelectHands", {
							mode: t(`screen.practice.modes.handsLong.${h}`),
						})}
						accessibilityState={{ selected }}
						style={{
							flex: 1,
							height: TAB_HEIGHT,
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "center",
							gap: space.xs,
							backgroundColor: selected
								? theme.colors.secondaryContainer
								: "transparent",
							borderLeftWidth: i > 0 ? 1 : 0,
							borderLeftColor: theme.colors.outlineVariant,
						}}
					>
						<Icon source={HANDS_ICON[h]} size={16} color={tint} />
						<Text variant="labelMedium" style={{ color: tint }}>
							{t(`screen.practice.modes.hands.${h}`)}
						</Text>
						{saved && (
							<Icon source="check" size={14} color={theme.colors.primary} />
						)}
					</Pressable>
				);
			})}
		</View>
	);
}
