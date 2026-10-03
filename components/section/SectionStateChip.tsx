import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Insets, Platform, type View } from "react-native";
import { Menu, useTheme } from "react-native-paper";
import { StateChip } from "@/components/ui/StateChip";
import { SECTION_STATES, type SectionState } from "@/models/section";
import { sectionStateVisual } from "@/utils/state-colors";

interface SectionStateChipProps {
	state: SectionState;
	onChangeState?: (state: SectionState) => void;
	hitSlop?: Required<Insets>;
}

export function SectionStateChip({
	state,
	onChangeState,
	hitSlop,
}: SectionStateChipProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const [menuOpen, setMenuOpen] = useState<boolean | null>(null);
	const chipRef = useRef<View>(null);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	useEffect(() => {
		if (menuOpen === false && Platform.OS === "web") chipRef.current?.focus();
	}, [menuOpen]);

	const chip = (
		<StateChip
			ref={chipRef}
			label={t(`section.state.${state}`)}
			visual={sectionStateVisual(state, theme.dark)}
			hitSlop={hitSlop}
			onPress={onChangeState ? () => setMenuOpen(true) : undefined}
			expanded={onChangeState ? menuOpen === true : undefined}
		/>
	);

	if (!onChangeState || !menuOpen) return chip;

	return (
		<Menu visible onDismiss={closeMenu} anchor={chip}>
			{SECTION_STATES.map((p) => (
				<Menu.Item
					key={p}
					title={t(`section.state.${p}`)}
					leadingIcon={p === state ? "check" : undefined}
					onPress={() => {
						closeMenu();
						onChangeState(p);
					}}
				/>
			))}
		</Menu>
	);
}
