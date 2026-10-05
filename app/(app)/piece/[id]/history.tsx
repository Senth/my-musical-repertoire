import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, ScrollView, View } from "react-native";
import {
	Appbar,
	Button,
	Chip,
	Divider,
	Text,
	useTheme,
} from "react-native-paper";
import { HistoryEntryRow } from "@/components/history/HistoryEntryRow";
import { HistoryLegend } from "@/components/history/HistoryLegend";
import { PracticeAppbarContent } from "@/components/practice/CoachShell";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { usePageInset } from "@/hooks/use-page-inset";
import { usePieces } from "@/hooks/use-pieces";
import { usePracticeHistory } from "@/hooks/use-practice-history";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { contentWidth, scrollTail, space, touchTarget } from "@/theme/tokens";
import {
	filterHistoryEntries,
	formatHistoryDay,
	type HistoryFilter,
	historyDayKey,
} from "@/utils/practice-history";

export default function PieceHistoryScreen() {
	const { id, sectionId } = useLocalSearchParams<{
		id: string;
		sectionId?: string;
	}>();
	const { t, i18n } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation(`/piece/${id}`);
	const pageInset = usePageInset();
	const { pieces, loading: piecesLoading } = usePieces();
	const piece = pieces.find((candidate) => candidate.id === id);
	const history = usePracticeHistory({ type: "piece", pieceId: id ?? "" });
	const routeKey = JSON.stringify([id, sectionId]);
	const [selection, setSelection] = useState<{
		routeKey: string;
		filter: HistoryFilter;
	} | null>(null);
	const requested: HistoryFilter =
		selection?.routeKey === routeKey
			? selection.filter
			: sectionId
				? `section:${sectionId}`
				: "all";
	const liveSections = history.sections
		.filter((section) => !section.archived)
		.sort((a, b) => a.order - b.order);
	const selectedSection = liveSections.find(
		(section) => requested === `section:${section.id}`,
	);
	const filter =
		requested.startsWith("section:") && !selectedSection ? "all" : requested;
	const entries = filterHistoryEntries(history.entries, filter);
	const filters: { value: HistoryFilter; label: string }[] = [
		{ value: "all", label: t("screen.history.all") },
		{ value: "run-throughs", label: t("screen.history.runThroughs") },
		...liveSections.map((section) => ({
			value: `section:${section.id}` as HistoryFilter,
			label: section.label,
		})),
	];
	if (piecesLoading) return <LoadingScreen />;
	if (!piece)
		return <MessageScreen message={t("screen.pieceDetail.pieceNotFound")} />;
	const retry = {
		label: t("screen.history.retry"),
		onPress: () => void history.loadMore(),
	};
	return (
		<View
			style={{
				flex: 1,
				minHeight: 0,
				backgroundColor: theme.colors.background,
			}}
		>
			<Appbar.Header>
				<Appbar.BackAction
					onPress={goBack}
					accessibilityLabel={t("screen.history.back")}
				/>
				<PracticeAppbarContent
					heading={{ title: t("screen.history.title"), subtitle: piece.title }}
				/>
			</Appbar.Header>
			<FlatList
				data={entries}
				keyExtractor={(entry) => entry.id}
				style={{
					flex: 1,
					width: "100%",
					maxWidth: contentWidth.page,
					alignSelf: "center",
				}}
				contentContainerStyle={{ flexGrow: 1, paddingBottom: scrollTail.plain }}
				ListHeaderComponent={
					<ScreenContent
						scroll={false}
						gap={2}
						paddingTop={space.sm}
						paddingBottom={space.sm}
					>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: space.sm }}
						>
							{filters.map((option) => (
								<Chip
									key={option.value}
									selected={filter === option.value}
									accessibilityLabel={option.label}
									accessibilityState={{ selected: filter === option.value }}
									onPress={() =>
										setSelection({ routeKey, filter: option.value })
									}
									style={{
										minHeight: touchTarget.minimum,
										justifyContent: "center",
									}}
								>
									{option.label}
								</Chip>
							))}
						</ScrollView>
						{history.entries.length > 0 && <HistoryLegend kind="piece" />}
					</ScreenContent>
				}
				renderItem={({ item, index }) => (
					<View style={{ paddingHorizontal: pageInset }}>
						{(index === 0 ||
							historyDayKey(item.date) !==
								historyDayKey(entries[index - 1].date)) && (
							<Text
								variant="labelSmall"
								style={{
									color: theme.colors.onSurfaceVariant,
									textTransform: "uppercase",
									paddingTop: space.lg,
									paddingBottom: space.xs,
								}}
							>
								{formatHistoryDay(item.date, t, i18n.language)}
							</Text>
						)}
						<HistoryEntryRow entry={item} sections={history.sections} />
					</View>
				)}
				ItemSeparatorComponent={() => <Divider />}
				ListEmptyComponent={
					history.loading ? (
						<LoadingScreen />
					) : history.error ? (
						<MessageScreen
							message={t("screen.history.loadError")}
							action={retry}
						/>
					) : filter === "all" && !history.hasMore ? (
						<MessageScreen
							icon="history"
							message={t("screen.history.emptyTitle")}
							body={t("screen.history.emptyPieceBody")}
							action={{
								label: t("screen.pieceDetail.practice"),
								onPress: () =>
									router.push(`/piece/${id}/practice?from=piece-detail`),
							}}
						/>
					) : filter !== "all" ? (
						<ScreenContent scroll={false}>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{filter === "run-throughs"
									? t("screen.history.emptyRunThroughs")
									: t("screen.history.emptySection", {
											section: selectedSection?.label,
										})}
							</Text>
						</ScreenContent>
					) : null
				}
				ListFooterComponent={
					<View style={{ paddingHorizontal: pageInset, paddingTop: space.sm }}>
						{history.error && entries.length > 0 && (
							<View>
								<Text variant="bodySmall" style={{ color: theme.colors.error }}>
									{t("screen.history.loadError")}
								</Text>
								<Button onPress={retry.onPress} disabled={history.loading}>
									{retry.label}
								</Button>
							</View>
						)}
						{history.hasMore && !history.error && (
							<Button
								mode="text"
								onPress={() => void history.loadMore()}
								loading={history.loading}
								disabled={history.loading}
							>
								{t("screen.history.showOlder")}
							</Button>
						)}
					</View>
				}
			/>
		</View>
	);
}
