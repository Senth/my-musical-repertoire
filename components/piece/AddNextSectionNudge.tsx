import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import {
	CARD_TITLE_STYLE,
	TITLE_ONLY_CARD_STYLE,
} from "@/components/ui/card-style";

interface AddNextSectionNudgeProps {
	pieceTitle: string;
	sectionLabel: string;
	/** Phase the named section sits in, for the copy. */
	phaseLabel: string;
	busy?: boolean;
	onAddSection: () => void;
	onNoMoreSections: () => void;
}

/**
 * Offered when a learning piece has no learning-phase sections left. Always one
 * tap to the action — "No more sections" is a decision the student records, not
 * a bare dismiss. See `docs/specs/section-progression-nudges.md` §5.3.
 */
export function AddNextSectionNudge({
	pieceTitle,
	sectionLabel,
	phaseLabel,
	busy,
	onAddSection,
	onNoMoreSections,
}: AddNextSectionNudgeProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Card mode="contained">
			<Card.Title
				title={t("screen.pieceSections.addNextNudge.title")}
				titleStyle={CARD_TITLE_STYLE}
				titleNumberOfLines={2}
				style={TITLE_ONLY_CARD_STYLE}
			/>
			<Card.Content>
				<View className="gap-2">
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.pieceSections.addNextNudge.body", {
							section: sectionLabel,
							phase: phaseLabel.toLowerCase(),
							piece: pieceTitle,
						})}
					</Text>
					<View className="flex-row gap-2 mt-1">
						<Button
							mode="contained"
							icon="plus"
							onPress={onAddSection}
							disabled={busy}
						>
							{t("screen.pieceSections.addNextNudge.add")}
						</Button>
						<Button mode="text" onPress={onNoMoreSections} disabled={busy}>
							{t("screen.pieceSections.addNextNudge.noMore")}
						</Button>
					</View>
				</View>
			</Card.Content>
		</Card>
	);
}
