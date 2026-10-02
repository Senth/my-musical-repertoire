import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Checkbox, Divider, Text } from "react-native-paper";
import { SectionRow } from "@/components/section/SectionRow";
import type { Piece } from "@/models/piece";
import type { Section, SectionState } from "@/models/section";
import { space } from "@/theme/tokens";

interface SectionsPracticePanelProps {
	sections: Section[];
	piece: Piece;
	mistakeLevel: "normal" | "checkbox" | "run-through";
	flaggedIds: string[];
	/**
	 * Sections a checkbox may appear on. A row outside this set keeps its plain
	 * appearance — ticking it would do nothing.
	 */
	flaggableIds?: string[];
	onToggleFlag: (sectionId: string) => void;
	onPractice?: (sectionId: string) => void;
	onChangeState?: (sectionId: string, state: SectionState) => void;
}

export function SectionsPracticePanel({
	sections,
	piece,
	mistakeLevel,
	flaggedIds,
	flaggableIds,
	onToggleFlag,
	onPractice,
	onChangeState,
}: SectionsPracticePanelProps) {
	const { t } = useTranslation();

	if (sections.length === 0) return null;

	const showCheckboxes = mistakeLevel !== "normal";
	const headerKey =
		mistakeLevel === "run-through"
			? "screen.practice.sectionsPanel.headerRunThrough"
			: mistakeLevel === "checkbox"
				? "screen.practice.sectionsPanel.headerCheckbox"
				: "screen.practice.sectionsPanel.header";

	return (
		<View style={{ gap: space.md }}>
			<Text variant="titleSmall">{t(headerKey)}</Text>
			<Divider />
			{sections.map((section) => {
				const sid = section.id ?? "";
				const checked = flaggedIds.includes(sid);
				const isCheckbox =
					showCheckboxes && (flaggableIds?.includes(sid) ?? true);
				return (
					<SectionRow
						key={sid}
						section={section}
						pieceTargetBpm={piece.targetTempoBpm}
						leading={
							isCheckbox ? (
								<View
									pointerEvents="none"
									importantForAccessibility="no-hide-descendants"
								>
									<Checkbox.Android
										pointerEvents="none"
										status={checked ? "checked" : "unchecked"}
									/>
								</View>
							) : undefined
						}
						onPress={isCheckbox ? () => onToggleFlag(sid) : undefined}
						pressRole={isCheckbox ? "checkbox" : undefined}
						checked={checked}
						pressLabel={
							isCheckbox
								? t("screen.practice.sectionsPanel.a11yToggleFlag", {
										label: section.label,
									})
								: undefined
						}
						onPractice={onPractice ? () => onPractice(sid) : undefined}
						onChangeState={
							onChangeState ? (state) => onChangeState(sid, state) : undefined
						}
					/>
				);
			})}
		</View>
	);
}
