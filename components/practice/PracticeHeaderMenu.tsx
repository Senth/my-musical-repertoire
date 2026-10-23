import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, type View, type ViewInstance } from "react-native";
import { Appbar, Menu } from "react-native-paper";

interface PracticeHeaderMenuProps {
	onEdit: () => void;
	onDelete: () => void;
	dialogOpen: boolean;
	labels: { edit: string; delete: string };
}

function focusTrigger(trigger: unknown) {
	if (Platform.OS === "web" && trigger instanceof HTMLElement)
		trigger.querySelector<HTMLElement>('[role="button"]')?.focus();
}

/**
 * The edit / delete overflow menu in a practice screen's app bar.
 *
 * Only mounted while open: a Paper `Menu` mounted closed runs a hide animation
 * on web whose completion focuses this anchor, blurring — and so closing — a
 * tempo editor opened in the first moments after the screen renders.
 */
export function PracticeHeaderMenu({
	onEdit,
	onDelete,
	dialogOpen,
	labels,
}: PracticeHeaderMenuProps) {
	const { t } = useTranslation();
	const [visible, setVisible] = useState<boolean | null>(null);
	const anchorRef = useRef<View & ViewInstance>(null);

	const editing = useRef(false);

	useEffect(() => {
		if (visible === false && !dialogOpen) focusTrigger(anchorRef.current);
	}, [visible, dialogOpen]);

	useFocusEffect(
		useCallback(() => {
			if (!editing.current) return;
			editing.current = false;
			focusTrigger(anchorRef.current);
		}, []),
	);

	const anchor = (
		<Appbar.Action
			ref={anchorRef}
			icon="dots-vertical"
			accessibilityLabel={t("a11y.menu.options")}
			onPress={() => setVisible(true)}
		/>
	);

	if (!visible) return anchor;

	return (
		<Menu visible onDismiss={() => setVisible(false)} anchor={anchor}>
			<Menu.Item
				leadingIcon="pencil"
				onPress={() => {
					setVisible(false);
					editing.current = true;
					onEdit();
				}}
				title={labels.edit}
			/>
			<Menu.Item
				leadingIcon="delete"
				onPress={() => {
					setVisible(false);
					onDelete();
				}}
				title={labels.delete}
			/>
		</Menu>
	);
}
