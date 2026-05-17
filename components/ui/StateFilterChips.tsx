import { ScrollView, View } from "react-native";
import { Chip } from "react-native-paper";

interface StateFilterChipsProps<T extends string> {
	states: T[];
	selected: T | "all";
	onSelect: (state: T | "all") => void;
	labelFor: (state: T | "all") => string;
}

export function StateFilterChips<T extends string>({
	states,
	selected,
	onSelect,
	labelFor,
}: StateFilterChipsProps<T>) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			className="py-2"
		>
			<View className="flex-row gap-2 px-4">
				{(["all", ...states] as (T | "all")[]).map((s) => (
					<Chip
						key={s}
						selected={selected === s}
						onPress={() => onSelect(s)}
						compact
					>
						{labelFor(s)}
					</Chip>
				))}
			</View>
		</ScrollView>
	);
}
