import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import { Icon, Text, useTheme } from "react-native-paper";
import type { ModeDraft } from "@/hooks/use-mode-drafts";
import { parseBpm } from "@/hooks/use-mode-drafts";
import type { PracticeDrill } from "@/models/practice";
import { HANDS_MODES, type HandsMode, type ModeKey } from "@/models/practice";
import { border } from "@/theme/tokens";
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
	/** Lifecycle chip at the tally line's right end. */
	chip?: ReactNode;
}

/**
 * Hand tabs with the save tally beneath and the lifecycle chip at its right
 * end. The tabs carry the hand icons and a check once that hand holds a
 * complete draft; the tally line spells out what the save will contain.
 */
export function HandTabs({
	available,
	hands,
	onChangeHands,
	drafts,
	drills,
	chip,
}: HandTabsProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const parts: string[] = [];
	for (const h of HANDS_MODES) {
		if (!available.includes(h)) continue;
		const keys = Object.keys(drafts).filter((key) => {
			const parsed = parseModeKey(key);
			return (
				parsed.hands === h &&
				(parsed.drill === null || drills.includes(parsed.drill))
			);
		});
		const complete = keys
			.map((key) => drafts[key])
			.find((d) => d.quality != null && d.effort != null);
		if (complete) {
			parts.push(
				t("screen.practice.tally.saved", {
					mode: t(`screen.practice.modes.hands.${h}`),
					bpm: parseBpm(complete.bpm) ?? "—",
					quality: t(
						`technique.qualityShort.${complete.quality}` as Parameters<
							typeof t
						>[0],
					),
				}),
			);
		} else if (keys.some((key) => drafts[key].bpm.trim() !== "")) {
			parts.push(
				t("screen.practice.tally.inProgress", {
					mode: t(`screen.practice.modes.hands.${h}`),
				}),
			);
		}
	}
	const tally = parts.length
		? t("screen.practice.tally.prefix", {
				tally: parts.join(t("screen.practice.modes.summarySeparator")),
			})
		: null;

	if (available.length <= 1 && !tally && !chip) return null;

	return (
		<View style={{ gap: 8 }}>
			{available.length > 1 && (
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
									gap: 4,
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
			)}
			{(tally || chip) && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 8,
					}}
				>
					<Text
						variant="bodySmall"
						numberOfLines={1}
						style={{
							color: theme.colors.onSurfaceVariant,
							flex: 1,
							minHeight: 16,
						}}
					>
						{tally ?? ""}
					</Text>
					{chip}
				</View>
			)}
		</View>
	);
}
