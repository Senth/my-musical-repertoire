import { View, Pressable } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PracticeMistakes } from "@/models/practice";

const MAX_STARS = 4;

const MISTAKE_LABELS: Record<PracticeMistakes, string> = {
	[PracticeMistakes.none]: "screen.practice.mistakeLevel.none",
	[PracticeMistakes.few]: "screen.practice.mistakeLevel.few",
	[PracticeMistakes.some]: "screen.practice.mistakeLevel.some",
	[PracticeMistakes.many]: "screen.practice.mistakeLevel.many",
	[PracticeMistakes.everywhere]: "screen.practice.mistakeLevel.everywhere",
};

interface MistakeRatingProps {
	label: string;
	value: PracticeMistakes;
	onChange: (value: PracticeMistakes) => void;
}

export function mistakesToStars(mistakes: PracticeMistakes): number {
	return MAX_STARS - mistakes;
}

export function starsToMistakes(stars: number): PracticeMistakes {
	return (MAX_STARS - stars) as PracticeMistakes;
}

export function MistakeRating({ label, value, onChange }: MistakeRatingProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const stars = mistakesToStars(value);

	const handlePress = (starIndex: number) => {
		const tappedStars = starIndex + 1;
		// Tapping the same star count toggles to 0
		const newStars = tappedStars === stars ? 0 : tappedStars;
		onChange(starsToMistakes(newStars));
	};

	return (
		<View className="gap-1">
			<Text variant="titleSmall">{label}</Text>
			<View className="flex-row items-center gap-1">
				{Array.from({ length: MAX_STARS }, (_, i) => (
					<Pressable key={i} onPress={() => handlePress(i)}>
						<MaterialCommunityIcons
							name={i < stars ? "star" : "star-outline"}
							size={36}
							color={
								i < stars
									? theme.colors.primary
									: theme.colors.onSurfaceVariant
							}
						/>
					</Pressable>
				))}
				<Text
					variant="bodyMedium"
					style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}
				>
					{t(MISTAKE_LABELS[value])}
				</Text>
			</View>
		</View>
	);
}
