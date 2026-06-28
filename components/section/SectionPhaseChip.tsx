import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chip, Menu, useTheme } from "react-native-paper";
import { SECTION_PHASES, type SectionPhase } from "@/models/section";

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

	const bgColor: Record<SectionPhase, string> = {
		learning: theme.colors.secondaryContainer,
		stabilizing: theme.colors.tertiaryContainer,
		maintenance: theme.colors.primaryContainer,
	};

	const textColor: Record<SectionPhase, string> = {
		learning: theme.colors.onSecondaryContainer,
		stabilizing: theme.colors.onTertiaryContainer,
		maintenance: theme.colors.onPrimaryContainer,
	};

	const chip = (
		<Chip
			compact
			style={{ backgroundColor: bgColor[phase], alignSelf: "flex-start" }}
			textStyle={{ color: textColor[phase], fontSize: 11 }}
			onPress={onChangePhase ? () => setMenuOpen(true) : undefined}
		>
			{t(`section.phase.${phase}`)}
		</Chip>
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
