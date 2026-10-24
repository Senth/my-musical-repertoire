import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Card,
	Divider,
	Searchbar,
	SegmentedButtons,
	Text,
	useTheme,
} from "react-native-paper";
import { CatalogRow } from "@/components/technique/CatalogRow";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useIsCompact } from "@/hooks/use-is-compact";
import { usePageInset } from "@/hooks/use-page-inset";
import { useAddCatalogTechnique, useTechniques } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import { scrollTail, space } from "@/theme/tokens";
import {
	byKey,
	byType,
	catalogEntries,
	catalogTitle,
	type TechniqueCatalogEntry,
} from "@/utils/technique-catalog";
import type { TechniqueCatalogMode } from "@/utils/technique-catalog-writes";
import { matchCatalog, normalizeTechniqueTitle } from "@/utils/technique-match";

const entries = catalogEntries();

export default function ScalesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const isCompact = useIsCompact();
	const pageInset = usePageInset();
	const goBack = useUpNavigation("/technique");
	const { techniques, loading } = useTechniques();
	const { addCatalogTechnique } = useAddCatalogTechnique();
	const [search, setSearch] = useState("");
	const [view, setView] = useState("key");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const matches = useMemo(() => {
		const results = matchCatalog(techniques, entries);
		return new Map(entries.map((entry, index) => [entry.key, results[index]]));
	}, [techniques]);
	const sections = useMemo(() => {
		const words = normalizeTechniqueTitle(search)
			.replace(/^([a-g][♯♭]?)m\b/, "$1 minor")
			.split(" ")
			.filter(Boolean);
		return (view === "key" ? byKey() : byType())
			.map((group) => ({
				...group,
				data: group.entries.filter((entry) => {
					const title = normalizeTechniqueTitle(catalogTitle(entry, t));
					return words.every((word) =>
						title
							.split(" ")
							.some((part) =>
								/^[a-g][♯♭]?$/.test(word)
									? part === word
									: part.startsWith(word),
							),
					);
				}),
			}))
			.filter((group) => group.data.length > 0);
	}, [search, view, t]);

	const add = async (
		entry: TechniqueCatalogEntry,
		mode: TechniqueCatalogMode,
	) => {
		if (adding) return;
		setAdding(true);
		try {
			await addCatalogTechnique(entry, catalogTitle(entry, t), mode);
		} catch {
			setError(t("technique.catalog.addError"));
		} finally {
			setAdding(false);
		}
	};
	const renderRow = (entry: TechniqueCatalogEntry) => (
		<CatalogRow
			entry={entry}
			match={matches.get(entry.key) ?? { kind: "none" }}
			disabled={adding}
			onAdd={(mode) => void add(entry, mode)}
		/>
	);
	const heading = (section: (typeof sections)[number]) => (
		<Text
			variant="titleSmall"
			accessibilityRole="header"
			style={{
				color: theme.colors.onSurfaceVariant,
				paddingTop: space.xl,
				paddingBottom: space.sm,
			}}
		>
			{t(
				section.titleKey as Parameters<typeof t>[0],
				section.titleParams ?? {},
			)}
		</Text>
	);
	const empty = (
		<ScreenContent scroll={false}>
			<Text
				variant="bodyMedium"
				style={{ color: theme.colors.onSurfaceVariant }}
			>
				{t("technique.catalog.noResults")}
			</Text>
		</ScreenContent>
	);

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
					accessibilityLabel={t("common.back")}
				/>
				<Appbar.Content title={t("technique.catalog.pageTitle")} />
			</Appbar.Header>
			<ScreenContent
				scroll={false}
				gap={2}
				paddingTop={space.md}
				paddingBottom={space.sm}
			>
				<Searchbar
					placeholder={t("technique.catalog.searchPlaceholder")}
					accessibilityLabel={t("technique.catalog.searchPlaceholder")}
					value={search}
					onChangeText={setSearch}
				/>
				<SegmentedButtons
					value={view}
					onValueChange={setView}
					buttons={[
						{ value: "key", label: t("technique.catalog.byKey") },
						{ value: "type", label: t("technique.catalog.byType") },
					]}
				/>
			</ScreenContent>
			{loading ? (
				<ActivityIndicator style={{ marginTop: space.xl }} />
			) : isCompact ? (
				<SectionList
					sections={sections}
					keyExtractor={(entry) => entry.key}
					renderItem={({ item }) => renderRow(item)}
					renderSectionHeader={({ section }) => (
						<View
							style={{
								paddingHorizontal: pageInset,
								backgroundColor: theme.colors.background,
							}}
						>
							{heading(section)}
						</View>
					)}
					ItemSeparatorComponent={Divider}
					stickySectionHeadersEnabled={false}
					ListEmptyComponent={empty}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ paddingBottom: scrollTail.plain }}
					style={{ flex: 1 }}
				/>
			) : (
				<ScreenContent
					gap={0}
					paddingTop={0}
					paddingBottom={scrollTail.plain}
					style={{ flex: 1 }}
				>
					{sections.length === 0 ? (
						<Text
							variant="bodyMedium"
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{t("technique.catalog.noResults")}
						</Text>
					) : (
						sections.map((section) => (
							<View key={section.key}>
								{heading(section)}
								<Card mode="elevated">
									{section.data.map((entry, index) => (
										<View key={entry.key}>
											{index > 0 && <Divider />}
											{renderRow(entry)}
										</View>
									))}
								</Card>
							</View>
						))
					)}
				</ScreenContent>
			)}
			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />
		</View>
	);
}
