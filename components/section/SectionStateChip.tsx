import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type Insets,
	Platform,
	type View,
	type ViewInstance,
} from "react-native";
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
	const chipRef = useRef<View & ViewInstance>(null);
	const closeMenu = useCallback(() => setMenuOpen(false), []);

	useEffect(() => {
		if (menuOpen === false && Platform.OS === "web") chipRef.current?.focus();
	}, [menuOpen]);

	const canChange = onChangeState != null;
	// Paper's Menu restarts its open animation whenever `anchor` changes
	// identity, and a restart mid-animation can leave the menu stuck
	// half-transparent, so the anchor survives parent re-renders.
	const chip = useMemo(
		() => (
			<StateChip
				ref={chipRef}
				label={t(`section.state.${state}`)}
				visual={sectionStateVisual(state, theme.dark)}
				hitSlop={hitSlop}
				onPress={canChange ? () => setMenuOpen(true) : undefined}
				expanded={canChange ? menuOpen === true : undefined}
			/>
		),
		[t, state, theme.dark, hitSlop, canChange, menuOpen],
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
