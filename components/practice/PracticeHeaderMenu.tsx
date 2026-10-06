import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, type View } from "react-native";
import { Appbar, Menu } from "react-native-paper";

interface PracticeHeaderMenuProps {
	onEdit: () => void;
	onDelete: () => void;
	labels: { edit: string; delete: string };
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
	labels,
}: PracticeHeaderMenuProps) {
	const { t } = useTranslation();
	const [visible, setVisible] = useState<boolean | null>(null);
	const anchorRef = useRef<View>(null);

	useEffect(() => {
		if (visible === false && Platform.OS === "web") anchorRef.current?.focus();
	}, [visible]);

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
