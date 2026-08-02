import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, useTheme } from "react-native-paper";
import { StateChip } from "@/components/ui/StateChip";
import { SECTION_PHASES, type SectionPhase } from "@/models/section";
import { sectionPhaseVisual } from "@/utils/state-colors";

interface SectionPhaseChipProps {
	phase: SectionPhase;
	onChangePhase?: (phase: SectionPhase) => void;
}

export function SectionPhaseChip({
	phase,
	onChangePhase,
}: SectionPhaseChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [menuOpen, setMenuOpen] = useState(false);

	const chip = (
		<StateChip
			label={t(`section.phase.${phase}`)}
			visual={sectionPhaseVisual(phase, theme.dark)}
			onPress={onChangePhase ? () => setMenuOpen(true) : undefined}
		/>
	);

	if (!onChangePhase || !menuOpen) return chip;

	return (
		<Menu visible onDismiss={() => setMenuOpen(false)} anchor={chip}>
			{SECTION_PHASES.map((p) => (
				<Menu.Item
					key={p}
					title={t(`section.phase.${p}`)}
					leadingIcon={p === phase ? "check" : undefined}
					onPress={() => {
						setMenuOpen(false);
						onChangePhase(p);
					}}
				/>
			))}
		</Menu>
	);
}
