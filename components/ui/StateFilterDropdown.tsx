import { useState } from "react";
import { View } from "react-native";
import { Chip, Menu } from "react-native-paper";

interface StateFilterDropdownProps<T extends string> {
	states: T[];
	selected: T | "all";
	onSelect: (state: T | "all") => void;
	labelFor: (state: T) => string;
	statusLabel: string;
}

export function StateFilterDropdown<T extends string>({
	states,
	selected,
	onSelect,
	labelFor,
	statusLabel,
}: StateFilterDropdownProps<T>) {
	const [menuVisible, setMenuVisible] = useState(false);
	const isFiltered = selected !== "all";
	const chipLabel = isFiltered ? labelFor(selected as T) : statusLabel;

	return (
		<View className="px-4 py-2 flex-row">
			<Menu
				visible={menuVisible}
				onDismiss={() => setMenuVisible(false)}
				anchor={
					<Chip
						compact
						selected={isFiltered}
						onPress={() => setMenuVisible(true)}
						closeIcon={isFiltered ? "close" : undefined}
						onClose={isFiltered ? () => onSelect("all") : undefined}
					>
						{chipLabel}
					</Chip>
				}
			>
				<Menu.Item
					title={statusLabel}
					onPress={() => {
						onSelect("all");
						setMenuVisible(false);
					}}
					trailingIcon={selected === "all" ? "check" : undefined}
				/>
				{states.map((s) => (
					<Menu.Item
						key={s}
						title={labelFor(s)}
						onPress={() => {
							onSelect(s);
							setMenuVisible(false);
						}}
						trailingIcon={selected === s ? "check" : undefined}
					/>
				))}
			</Menu>
		</View>
	);
}
