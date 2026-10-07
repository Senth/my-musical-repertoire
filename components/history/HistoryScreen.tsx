import { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, View } from "react-native";
import { Appbar, Button, Divider, Text, useTheme } from "react-native-paper";
import { HistoryEntryRow } from "@/components/history/HistoryEntryRow";
import { HistoryLegend } from "@/components/history/HistoryLegend";
import { PracticeAppbarContent } from "@/components/practice/CoachShell";
import { LoadingScreen, MessageScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { usePageInset } from "@/hooks/use-page-inset";
import type { usePracticeHistory } from "@/hooks/use-practice-history";
import { contentWidth, scrollTail, space } from "@/theme/tokens";
import {
	formatHistoryDay,
	type HistoryEntry,
	historyDayKey,
} from "@/utils/practice-history";

export function HistoryScreen({
	kind,
	subtitle,
	history,
	entries,
	filters,
	emptyBody,
	emptyMessage,
	onBack,
	onPractice,
}: {
	kind: "piece" | "technique";
	subtitle: string;
	history: ReturnType<typeof usePracticeHistory>;
	entries: HistoryEntry[];
	filters?: ReactNode;
	emptyBody: string;
	emptyMessage?: string;
	onBack: () => void;
	onPractice: () => void;
}) {
	const { t, i18n } = useTranslation();
	const theme = useTheme();
	const pageInset = usePageInset();
	useEffect(() => {
		if (
			!entries.length &&
			history.hasMore &&
			!history.loading &&
			!history.error
		)
			void history.loadMore();
	}, [
		entries.length,
		history.hasMore,
		history.loading,
		history.error,
		history.loadMore,
	]);
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
					onPress={onBack}
					accessibilityLabel={t("screen.history.back")}
				/>
				<PracticeAppbarContent
					heading={{ title: t("screen.history.title"), subtitle }}
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
						{filters}
						{history.entries.length > 0 && <HistoryLegend kind={kind} />}
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
					history.loading || (history.hasMore && !history.error) ? (
						<LoadingScreen />
					) : history.error ? (
						<MessageScreen
							message={t("screen.history.loadError")}
							action={retry}
						/>
					) : emptyMessage ? (
						<ScreenContent scroll={false}>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{emptyMessage}
							</Text>
						</ScreenContent>
					) : !history.hasMore ? (
						<MessageScreen
							icon="history"
							message={t("screen.history.emptyTitle")}
							body={emptyBody}
							action={{
								label: t(
									kind === "piece"
										? "screen.pieceDetail.practice"
										: "screen.techniqueDetail.practice",
								),
								onPress: onPractice,
							}}
						/>
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
						{history.hasMore && !history.error && entries.length > 0 && (
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
