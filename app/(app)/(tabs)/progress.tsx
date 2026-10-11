import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Divider, List, Text } from "react-native-paper";
import { ProgressRow } from "@/components/progress/ProgressRow";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import { useTechniques } from "@/hooks/use-techniques";
import { HANDS_MODES } from "@/models/practice";
import type { Section } from "@/models/section";
import { useAppTheme } from "@/theme";
import { scrollTail, space } from "@/theme/tokens";
import { buildProgressRows } from "@/utils/repertoire-progress";

export default function ProgressScreen() {
	const { t } = useTranslation();
	const theme = useAppTheme();
	const router = useRouter();
	const { pieces, loading: piecesLoading } = usePieces();
	const { sections, loading: sectionsLoading } = useAllSections();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const [expanded, setExpanded] = useState(false);
	const { rows, atTarget } = useMemo(() => {
		const sectionsByPiece: Record<string, Section[]> = {};
		for (const section of sections) {
			sectionsByPiece[section.pieceId] ??= [];
			sectionsByPiece[section.pieceId].push(section);
		}
		return buildProgressRows({ pieces, sectionsByPiece, techniques });
	}, [pieces, sections, techniques]);

	if (piecesLoading || sectionsLoading || techniquesLoading)
		return <LoadingScreen />;
	if (rows.length === 0 && atTarget.length === 0)
		return (
			<MessageScreen
				message={t("screen.progress.title")}
				body={t("screen.progress.empty")}
				icon="trending-up"
				action={{
					label: t("screen.pieces.title"),
					onPress: () => router.push("/piece"),
				}}
			/>
		);

	return (
		<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
			<ScreenContent
				gap={0}
				paddingBottom={scrollTail.plain}
				style={{ flex: 1 }}
			>
				<View style={{ gap: space.xs, marginBottom: space.lg }}>
					<Text variant="titleLarge" accessibilityRole="header">
						{t("screen.progress.title")}
					</Text>
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.progress.subtitle")}
					</Text>
				</View>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						flexWrap: "wrap",
						gap: space.md,
						marginBottom: space.xs,
					}}
				>
					<View style={{ flexDirection: "row", gap: space.md }}>
						{HANDS_MODES.map((hands) => (
							<Text
								key={hands}
								variant="labelSmall"
								accessibilityLabel={t(`screen.progressChart.hands.${hands}`)}
								style={{
									fontWeight: "bold",
									color:
										hands === "LH"
											? theme.colors.handLeft
											: hands === "RH"
												? theme.colors.handRight
												: theme.colors.onSurface,
								}}
							>
								{t(`screen.progressChart.handsShort.${hands}`)}
							</Text>
						))}
					</View>
					<Text
						variant="bodySmall"
						style={{
							flex: 1,
							textAlign: "right",
							color: theme.colors.onSurfaceVariant,
						}}
					>
						{t("screen.progress.order")}
					</Text>
				</View>
				{rows.map((row) => (
					<ProgressRow
						key={
							row.kind === "section"
								? `section-${row.section.id}`
								: `technique-${row.technique.id}`
						}
						row={row}
					/>
				))}
				{atTarget.length > 0 && (
					<View>
						<List.Item
							title={t("screen.progress.atTarget", { count: atTarget.length })}
							titleStyle={{ color: theme.colors.onSurfaceVariant }}
							titleNumberOfLines={2}
							accessibilityRole="button"
							accessibilityLabel={t("screen.progress.atTarget", {
								count: atTarget.length,
							})}
							accessibilityState={{ expanded }}
							aria-expanded={expanded}
							onPress={() => setExpanded(!expanded)}
							right={(props) => (
								<List.Icon
									{...props}
									color={theme.colors.onSurfaceVariant}
									icon={expanded ? "chevron-down" : "chevron-right"}
								/>
							)}
							style={{ paddingHorizontal: 0 }}
						/>
						<Divider />
						{expanded &&
							atTarget.map((row) => (
								<ProgressRow
									key={
										row.kind === "section"
											? `section-${row.section.id}`
											: `technique-${row.technique.id}`
									}
									row={row}
								/>
							))}
					</View>
				)}
			</ScreenContent>
		</View>
	);
}
