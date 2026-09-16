import { View } from "react-native";
import { IconButton, useTheme } from "react-native-paper";
import { border, radius } from "@/theme/tokens";

/** The filter-active badge dot's diameter. */
const DOT_SIZE = 10;

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
							width: DOT_SIZE,
							height: DOT_SIZE,
							borderRadius: radius.full,
							backgroundColor: theme.colors.primary,
							borderWidth: border.hairline,
							borderColor: theme.colors.elevation.level2,
						}}
					/>
				)}
			</View>
		</View>
	);
}
