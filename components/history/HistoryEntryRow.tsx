import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon, Text, TouchableRipple } from "react-native-paper";
import { BpmValue } from "@/components/history/BpmValue";
import { HandsIcon } from "@/components/history/HandsIcon";
import { historyScoreLabel, ScoreMeter } from "@/components/history/ScoreMeter";
import { SectionBar } from "@/components/history/SectionBar";
import type { HistorySection } from "@/hooks/use-practice-history";
import { useAppTheme } from "@/theme";
import { icon, size, space, touchTarget } from "@/theme/tokens";
import type { HistoryEntry, HistoryMode } from "@/utils/practice-history";
import { computeSectionBar } from "@/utils/section-bar";

function ModeRow({
	mode,
	runThrough,
}: {
	mode: HistoryMode;
	runThrough: boolean;
}) {
	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: space.sm,
				minHeight: space.xl + space.xs,
			}}
		>
			<View style={{ width: size.control }}>
				<HandsIcon hands={runThrough ? "HT" : mode.hands} />
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<ScoreMeter
					metric={runThrough ? "technical" : "quality"}
					value={runThrough ? mode.technicalMistakes : mode.quality}
				/>
			</View>
			<View style={{ flex: 1, minWidth: 0 }}>
				<ScoreMeter
					metric={runThrough ? "memory" : "effort"}
					value={runThrough ? mode.memoryMistakes : mode.effort}
				/>
			</View>
			<View
				style={{
					width: touchTarget.minimum + space.lg,
					alignItems: "flex-end",
				}}
			>
				{!runThrough && <BpmValue value={mode.achievedBpm} />}
			</View>
		</View>
	);
}

export function HistoryEntryRow({
	entry,
	sections = [],
}: {
	entry: HistoryEntry;
	sections?: readonly HistorySection[];
}) {
	const { t, i18n } = useTranslation();
	const theme = useAppTheme();
	const [expanded, setExpanded] = useState(false);
	const runThrough = entry.kind === "run-through";
	const sectionId =
		entry.scope.type === "section" ? entry.scope.sectionId : null;
	const section = sections.find((candidate) => candidate.id === sectionId);
	const baseTitle = runThrough
		? t("screen.history.runThrough")
		: entry.kind === "credited"
			? t("screen.history.credited")
			: (section?.label ?? t("screen.history.unavailableSection"));
	const title = section?.archived
		? t("screen.history.archivedTitle", { label: baseTitle })
		: baseTitle;
	const barRange =
		section?.startBar != null
			? section.endBar != null
				? t("screen.pieceSections.barRange", {
						start: section.startBar,
						end: section.endBar,
					})
				: t("screen.pieceSections.barFrom", { start: section.startBar })
			: null;
	const bar =
		entry.kind === "technique"
			? null
			: computeSectionBar({
					sections,
					played: runThrough
						? { kind: "run-through" }
						: {
								kind: "section",
								sectionId: sectionId ?? "",
								ranges:
									section?.startBar != null && section.endBar != null
										? [{ startBar: section.startBar, endBar: section.endBar }]
										: [],
							},
					flaggedSectionIds: entry.flaggedSectionIds,
				});
	const sectionLabel = (id: string) =>
		sections.find((candidate) => candidate.id === id)?.label ??
		t("screen.history.unavailableSection");
	const list = (labels: string[]) =>
		new Intl.ListFormat(i18n.language, { style: "long", type: "unit" }).format(
			labels,
		);
	const playedSectionsLabel = bar
		? t("screen.history.playedSections", {
				sections: list(
					bar.segments
						.filter((segment) => segment.fill > 0)
						.map((segment) => sectionLabel(segment.sectionId)),
				),
			})
		: null;
	const shaky =
		runThrough && entry.flaggedSectionIds.length > 0
			? t("screen.history.shaky", {
					sections: list(entry.flaggedSectionIds.map(sectionLabel)),
				})
			: null;
	const content = (
		<View style={{ paddingVertical: space.md, gap: space.xs }}>
			{entry.kind !== "technique" && (
				<View
					style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
				>
					<Text
						variant="bodyLarge"
						numberOfLines={1}
						style={{
							flex: 1,
							color: section?.archived
								? theme.colors.onSurfaceVariant
								: theme.colors.onSurface,
						}}
					>
						{title}
					</Text>
					{runThrough ? (
						<BpmValue value={entry.modes[0]?.achievedBpm} />
					) : barRange ? (
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{barRange}
						</Text>
					) : null}
				</View>
			)}
			{bar && playedSectionsLabel && (
				<SectionBar
					segments={bar.segments}
					accessibilityLabel={playedSectionsLabel}
				/>
			)}
			<View>
				{entry.modes.map((mode) => (
					<ModeRow key={mode.id} mode={mode} runThrough={runThrough} />
				))}
				{entry.drillGroups.map((group) => (
					<View key={group.drill}>
						<Text
							variant="labelSmall"
							style={{
								color: theme.colors.onSurfaceVariant,
								marginTop: space.xs,
								textTransform: "uppercase",
							}}
						>
							{t(`screen.practice.modes.drill.${group.drill}`)}
						</Text>
						{group.modes.map((mode) => (
							<ModeRow key={mode.id} mode={mode} runThrough={false} />
						))}
					</View>
				))}
			</View>
			{shaky && (
				<View
					style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}
				>
					<Icon
						source="alert-outline"
						size={icon.sm}
						color={theme.colors.warning}
					/>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.warning, flex: 1 }}
					>
						{shaky}
					</Text>
				</View>
			)}
			{entry.note && (
				<View
					style={{
						flexDirection: "row",
						alignItems: "flex-start",
						gap: space.xs,
					}}
				>
					<Icon
						source="note-text-outline"
						size={icon.sm}
						color={theme.colors.onSurfaceVariant}
					/>
					<Text
						variant="bodySmall"
						numberOfLines={expanded ? undefined : 1}
						style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
					>
						{entry.note}
					</Text>
				</View>
			)}
		</View>
	);
	if (!entry.note) return content;
	const modeLabels = [
		...entry.modes,
		...entry.drillGroups.flatMap((group) => group.modes),
	].map((mode) =>
		list([
			...(mode.drill ? [t(`screen.practice.modes.drill.${mode.drill}`)] : []),
			t(`screen.practice.modes.handsLong.${runThrough ? "HT" : mode.hands}`),
			historyScoreLabel(
				runThrough ? "technical" : "quality",
				runThrough ? mode.technicalMistakes : mode.quality,
				t,
			),
			historyScoreLabel(
				runThrough ? "memory" : "effort",
				runThrough ? mode.memoryMistakes : mode.effort,
				t,
			),
			...(mode.achievedBpm != null
				? [t("screen.pieceSections.bpm", { bpm: mode.achievedBpm })]
				: []),
		]),
	);
	return (
		<TouchableRipple
			onPress={() => setExpanded(!expanded)}
			accessibilityRole="button"
			accessibilityLabel={list([
				...(entry.kind !== "technique" ? [title] : []),
				...(barRange ? [barRange] : []),
				...(playedSectionsLabel ? [playedSectionsLabel] : []),
				...modeLabels,
				...(shaky ? [shaky] : []),
				entry.note,
			])}
			accessibilityHint={t(
				expanded ? "screen.history.collapseNote" : "screen.history.expandNote",
			)}
			accessibilityState={{ expanded }}
		>
			{content}
		</TouchableRipple>
	);
}
