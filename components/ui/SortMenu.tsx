import { Menu } from "react-native-paper";
import type { SortDir } from "@/utils/list-sorting";

export interface SortMenuOption {
	key: string;
	label: string;
}

interface SortMenuProps<K extends string> {
	/** Press coordinates of the header button; `null` keeps the menu unmounted. */
	anchor: { x: number; y: number } | null;
	onDismiss: () => void;
	options: SortMenuOption[];
	sortKey: K;
	sortDir: SortDir;
	/** Tapping the active sort is a direction toggle; the caller decides. */
	onSelect: (key: K) => void;
}

/**
 * Sort picker for a list header. The active option carries a check plus an
 * arrow showing which way it currently runs.
 *
 * Only mounted while open: a Paper `Menu` mounted closed runs a hide animation
 * on web that steals focus from the search field below it.
 */
export function SortMenu<K extends string>({
	anchor,
	onDismiss,
	options,
	sortKey,
	sortDir,
	onSelect,
}: SortMenuProps<K>) {
	if (!anchor) return null;

	return (
		<Menu visible onDismiss={onDismiss} anchor={anchor}>
			{options.map((option) => {
				const active = option.key === sortKey;
				return (
					<Menu.Item
						key={option.key}
						title={option.label}
						leadingIcon={active ? "check" : undefined}
						trailingIcon={
							active
								? sortDir === "asc"
									? "arrow-up"
									: "arrow-down"
								: undefined
						}
						onPress={() => onSelect(option.key as K)}
					/>
				);
			})}
		</Menu>
	);
}
