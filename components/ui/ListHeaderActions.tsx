import { View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";

interface ListHeaderActionsProps {
	sortLabel: string;
	filterLabel: string;
	/** Shows the badge dot — any filter deviating from the defaults is active. */
	filtersActive: boolean;
	onOpenSort: (position: { x: number; y: number }) => void;
	onOpenFilter: () => void;
}

/** The ↕ / ⚇ pair a list screen installs as its `headerRight`. */
export function ListHeaderActions({
	sortLabel,
	filterLabel,
	filtersActive,
	onOpenSort,
	onOpenFilter,
}: ListHeaderActionsProps) {
	const theme = useTheme();

	return (
		<View style={{ flexDirection: "row", alignItems: "center" }}>
			<IconButton
				icon="sort"
				accessibilityLabel={sortLabel}
				onPress={(e) =>
					onOpenSort({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })
				}
			/>
			<View>
				<IconButton
					icon="filter-variant"
					accessibilityLabel={filterLabel}
					onPress={onOpenFilter}
				/>
				{filtersActive && (
					<View
						pointerEvents="none"
						style={{
							position: "absolute",
							top: 6,
							right: 6,
							width: 10,
							height: 10,
							borderRadius: 5,
							backgroundColor: theme.colors.primary,
							borderWidth: 1,
							borderColor: theme.colors.elevation.level2,
						}}
					/>
				)}
			</View>
		</View>
	);
}
