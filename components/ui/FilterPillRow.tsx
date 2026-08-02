import { ScrollView, View } from "react-native";
import { Button, Chip } from "react-native-paper";

export interface FilterPillItem {
	id: string;
	label: string;
	/** Screen-reader label for the pill's ✕. */
	removeLabel: string;
}

interface FilterPillRowProps {
	pills: FilterPillItem[];
	onRemove: (id: string) => void;
	onClearAll: () => void;
	clearAllLabel: string;
}

/**
 * Active filters as removable pills. Renders nothing at all when no filter is
 * active, so an unfiltered list carries no extra chrome.
 */
export function FilterPillRow({
	pills,
	onRemove,
	onClearAll,
	clearAllLabel,
}: FilterPillRowProps) {
	if (pills.length === 0) return null;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			// A ScrollView grows by default; left unchecked this horizontal row
			// would claim half the screen's height and push the list off-screen.
			style={{ flexGrow: 0, flexShrink: 0 }}
			contentContainerStyle={{
				paddingHorizontal: 16,
				paddingBottom: 8,
				gap: 8,
				alignItems: "center",
			}}
		>
			{pills.map((pill) => (
				<Chip
					key={pill.id}
					compact
					closeIcon="close"
					onClose={() => onRemove(pill.id)}
					closeIconAccessibilityLabel={pill.removeLabel}
					onPress={() => onRemove(pill.id)}
				>
					{pill.label}
				</Chip>
			))}
			<View>
				<Button compact mode="text" onPress={onClearAll}>
					{clearAllLabel}
				</Button>
			</View>
		</ScrollView>
	);
}
