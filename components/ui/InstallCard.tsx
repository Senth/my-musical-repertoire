import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Card, Text, useTheme } from "react-native-paper";
import {
	CARD_TITLE_STYLE,
	TITLE_ONLY_CARD_STYLE,
} from "@/components/ui/card-style";

interface InstallCardProps {
	onInstall: () => void;
	onDismiss: () => void;
}

/**
 * Offers to install the PWA. Rendered only when
 * {@link import("@/utils/install-gating").shouldOfferInstall} allows it — this
 * component does no gating of its own.
 */
export function InstallCard({ onInstall, onDismiss }: InstallCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	return (
		<Card mode="contained">
			<Card.Title
				title={t("screen.overview.install.title")}
				titleStyle={CARD_TITLE_STYLE}
				style={TITLE_ONLY_CARD_STYLE}
			/>
			<Card.Content>
				<View className="gap-2">
					<Text
						variant="bodyMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.overview.install.body")}
					</Text>
					<View className="flex-row gap-2 mt-1">
						<Button mode="contained" icon="download" onPress={onInstall}>
							{t("screen.overview.install.install")}
						</Button>
						<Button mode="text" onPress={onDismiss}>
							{t("screen.overview.install.notNow")}
						</Button>
					</View>
				</View>
			</Card.Content>
		</Card>
	);
}
