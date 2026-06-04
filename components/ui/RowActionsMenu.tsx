import type { ReactNode } from "react";
import { Menu } from "react-native-paper";

interface RowActionsMenuProps {
	visible: boolean;
	onDismiss: () => void;
	/** An anchor element (e.g. an IconButton) or screen coordinates for a long-press menu. */
	anchor: ReactNode | { x: number; y: number };
	onPractice: () => void;
	onEdit: () => void;
	onDelete: () => void;
	labels: { practice: string; edit: string; delete: string };
}

/**
 * The practice / edit / delete overflow menu shared by the piece and technique
 * list cards and their long-press context menus.
 */
export function RowActionsMenu({
	visible,
	onDismiss,
	anchor,
	onPractice,
	onEdit,
	onDelete,
	labels,
}: RowActionsMenuProps) {
	return (
		<Menu visible={visible} onDismiss={onDismiss} anchor={anchor}>
			<Menu.Item
				leadingIcon="play"
				onPress={onPractice}
				title={labels.practice}
			/>
			<Menu.Item leadingIcon="pencil" onPress={onEdit} title={labels.edit} />
			<Menu.Item
				leadingIcon="delete"
				onPress={onDelete}
				title={labels.delete}
			/>
		</Menu>
	);
}
