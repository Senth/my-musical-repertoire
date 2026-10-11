import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Icon, Text, useTheme } from "react-native-paper";
import { usePageInset } from "@/hooks/use-page-inset";
import type { Section } from "@/models/section";
import { icon, space } from "@/theme/tokens";
import { sectionsMissingSpanBars } from "@/utils/span-missing-bars";

export function MissingBarsNotice({
	pieceId,
	sections,
}: {
	pieceId: string;
	sections: Section[];
}) {
	const { t, i18n } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const pageInset = usePageInset();
	const missing = sectionsMissingSpanBars(sections);
	const first = missing[0];
	if (!first) return null;

	const labels = new Intl.ListFormat(i18n.language, {
		type: "conjunction",
	}).format(missing.map((section) => section.label));

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: space.sm,
				paddingHorizontal: pageInset,
				paddingBottom: space.xs,
			}}
		>
			<Icon
				source="information-outline"
				size={icon.sm}
				color={theme.colors.onSurfaceVariant}
			/>
			<Text
				variant="bodySmall"
				style={{ flex: 1, color: theme.colors.onSurfaceVariant }}
			>
				{t("screen.pieceSections.missingBars.line", { sections: labels })}
			</Text>
			<Button
				mode="text"
				compact
				accessibilityLabel={t("screen.pieceSections.missingBars.actionA11y", {
					section: first.label,
				})}
				onPress={() => router.push(`/piece/${pieceId}/section/${first.id}`)}
			>
				{t("screen.pieceSections.missingBars.action")}
			</Button>
		</View>
	);
}
