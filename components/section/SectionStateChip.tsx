import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, useTheme } from "react-native-paper";
import { StateChip } from "@/components/ui/StateChip";
import { SECTION_STATES, type SectionState } from "@/models/section";
import { sectionStateVisual } from "@/utils/state-colors";

interface SectionStateChipProps {
	state: SectionState;
	onChangeState?: (state: SectionState) => void;
}

export function SectionStateChip({
	state,
	onChangeState,
}: SectionStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [menuOpen, setMenuOpen] = useState<boolean | null>(null);

	const chip = (
		<StateChip
			label={t(`section.state.${state}`)}
			visual={sectionStateVisual(state, theme.dark)}
			onPress={onChangeState ? () => setMenuOpen(true) : undefined}
			expanded={onChangeState ? menuOpen === true : undefined}
		/>
	);

	if (!onChangeState || menuOpen === null) return chip;

	return (
		<Menu visible={menuOpen} onDismiss={() => setMenuOpen(false)} anchor={chip}>
			{SECTION_STATES.map((p) => (
				<Menu.Item
					key={p}
					title={t(`section.state.${p}`)}
					leadingIcon={p === state ? "check" : undefined}
					onPress={() => {
						setMenuOpen(false);
						onChangeState(p);
					}}
				/>
			))}
		</Menu>
	);
}
