import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Chip, Text, useTheme } from "react-native-paper";
import type { PracticeDrill } from "@/models/practice";
import { type ByMode, HANDS_MODES, type HandsMode } from "@/models/practice";
import { modeLabel } from "@/utils/mode-label";
import { hsTarget, parseModeKey } from "@/utils/practice-modes";

const HANDS_ICON: Record<HandsMode, string> = {
	LH: "hand-back-left",
	RH: "hand-back-right",
	HT: "hand-clap",
};

/** LH, RH, HT first (normal drill), then their drill variants in the same order. */
function summaryOrder(key: string): number {
	const { hands, drill } = parseModeKey(key);
	return (drill ? HANDS_MODES.length : 0) + HANDS_MODES.indexOf(hands);
}

interface ModeSelectorProps {
	available: HandsMode[];
	hands: HandsMode;
	onChangeHands: (hands: HandsMode) => void;
	drills: PracticeDrill[];
	drill: PracticeDrill | null;
	onChangeDrill: (drill: PracticeDrill | null) => void;
	byMode: ByMode;
	effectiveTarget: number | null;
	htReady: boolean;
}

/**
 * Hands + drill chip rows with an always-visible summary of every practised
 * mode, so comparing hands never needs a tap. A row offering a single choice is
 * not rendered at all — the practice screen is already cramped.
 */
export function ModeSelector({
	available,
	hands,
	onChangeHands,
	drills,
	drill,
	onChangeDrill,
	byMode,
	effectiveTarget,
	htReady,
}: ModeSelectorProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const separateTarget = hsTarget(effectiveTarget);
	const showHandsRow = available.length > 1;
	const showDrillRow = drills.length > 0;

	// Only advertise modes the chips can actually reach. A technique switched
	// from `both` to `separate` keeps its old HT stats, and showing a tempo the
	// student cannot select or beat is noise.
	const isSelectable = (key: string): boolean => {
		const { hands: h, drill: d } = parseModeKey(key);
		if (!available.includes(h)) return false;
		return d === null || drills.includes(d);
	};

	const summary = Object.entries(byMode)
		.filter(([key, stats]) => stats?.bpm != null && isSelectable(key))
		.sort(([a], [b]) => summaryOrder(a) - summaryOrder(b))
		.map(([key, stats]) =>
			t("screen.practice.modes.summaryEntry", {
				mode: modeLabel(key, t),
				bpm: stats.bpm,
			}),
		)
		.join(t("screen.practice.modes.summarySeparator"));

	const targetSummary = (): string | null => {
		if (effectiveTarget == null || separateTarget == null) return null;
		const hasSeparate = available.some((h) => h !== "HT");
		const hasTogether = available.includes("HT");
		if (hasSeparate && hasTogether) {
			return t("screen.practice.modes.summaryTargetBoth", {
				separate: separateTarget,
				together: effectiveTarget,
			});
		}
		return t("screen.practice.modes.summaryTargetOne", {
			bpm: hasTogether ? effectiveTarget : separateTarget,
		});
	};

	const summaryTarget = targetSummary();

	if (!showHandsRow && !showDrillRow && !summary) return null;

	return (
		<View className="gap-2">
			{showHandsRow && (
				<View className="flex-row flex-wrap items-center gap-2">
					<Text variant="titleSmall">
						{t("screen.practice.modes.handsLabel")}
					</Text>
					{available.map((h) => (
						<Chip
							key={h}
							icon={HANDS_ICON[h]}
							selected={h === hands}
							showSelectedOverlay
							onPress={() => onChangeHands(h)}
							accessibilityLabel={t("screen.practice.modes.a11ySelectHands", {
								mode: t(`screen.practice.modes.handsLong.${h}`),
							})}
							accessibilityState={{ selected: h === hands }}
						>
							{t(`screen.practice.modes.hands.${h}`)}
						</Chip>
					))}
				</View>
			)}

			{showDrillRow && (
				<View className="flex-row flex-wrap items-center gap-2">
					<Text variant="titleSmall">
						{t("screen.practice.modes.drillLabel")}
					</Text>
					<Chip
						selected={drill === null}
						showSelectedOverlay
						onPress={() => onChangeDrill(null)}
						accessibilityLabel={t("screen.practice.modes.a11ySelectDrill", {
							drill: t("screen.practice.modes.drill.normal"),
						})}
						accessibilityState={{ selected: drill === null }}
					>
						{t("screen.practice.modes.drill.normal")}
					</Chip>
					{drills.map((d) => (
						<Chip
							key={d}
							selected={drill === d}
							showSelectedOverlay
							onPress={() => onChangeDrill(d)}
							accessibilityLabel={t("screen.practice.modes.a11ySelectDrill", {
								drill: t(`screen.practice.modes.drill.${d}`),
							})}
							accessibilityState={{ selected: drill === d }}
						>
							{t(`screen.practice.modes.drill.${d}`)}
						</Chip>
					))}
				</View>
			)}

			{!!summary && (
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{summaryTarget ? `${summary}   ${summaryTarget}` : summary}
				</Text>
			)}

			{htReady && hands === "HT" && separateTarget != null && (
				<Text variant="bodySmall" style={{ color: theme.colors.primary }}>
					{t("screen.practice.modes.htReadyHint", { bpm: separateTarget })}
				</Text>
			)}
		</View>
	);
}
