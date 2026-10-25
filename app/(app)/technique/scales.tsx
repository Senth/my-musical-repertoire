import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SectionList, View } from "react-native";
import {
	ActivityIndicator,
	Appbar,
	Button,
	Card,
	Divider,
	Searchbar,
	SegmentedButtons,
	Text,
	useTheme,
} from "react-native-paper";
import { CatalogRow } from "@/components/technique/CatalogRow";
import { NearMatchDialog } from "@/components/technique/NearMatchDialog";
import { ErrorSnackbar } from "@/components/ui/ErrorSnackbar";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useIsCompact } from "@/hooks/use-is-compact";
import { usePageInset } from "@/hooks/use-page-inset";
import {
	useAddAllCatalog,
	useAddCatalogTechnique,
	useLinkCatalogTechnique,
	useTechniques,
} from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import type { TechniqueItem } from "@/models/technique";
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

type CatalogLink = {
	entry: TechniqueCatalogEntry;
	technique: TechniqueItem & { id: string };
	rename: boolean;
};
type BulkAdd = {
	additions: TechniqueCatalogEntry[];
	links: CatalogLink[];
	n: number;
	total: number;
	others: number;
};
type PendingMatch = {
	entry: TechniqueCatalogEntry;
	technique: TechniqueItem & { id: string };
	mode: TechniqueCatalogMode;
	bulk?: BulkAdd;
};

export default function ScalesScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const isCompact = useIsCompact();
	const pageInset = usePageInset();
	const goBack = useUpNavigation("/technique");
	const { techniques, loading } = useTechniques();
	const { addCatalogTechnique } = useAddCatalogTechnique();
	const { addAllCatalog } = useAddAllCatalog();
	const { linkCatalogTechnique } = useLinkCatalogTechnique();
	const [search, setSearch] = useState("");
	const [view, setView] = useState("key");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingMatch | null>(null);
	const matches = useMemo(() => {
		const results = matchCatalog(techniques, entries);
		return new Map(entries.map((entry, index) => [entry.key, results[index]]));
	}, [techniques]);
	const missing = entries.filter(
		(entry) => matches.get(entry.key)?.kind !== "exact",
	);
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

	const save = async (
		entry: TechniqueCatalogEntry,
		mode: TechniqueCatalogMode,
		link?: CatalogLink,
	) => {
		setAdding(true);
		try {
			if (link) {
				await linkCatalogTechnique(
					link.technique.id,
					entry,
					link.rename,
					link.technique.type,
				);
			} else {
				await addCatalogTechnique(entry, catalogTitle(entry, t), mode);
			}
		} catch {
			setError(t("technique.catalog.addError"));
		} finally {
			setAdding(false);
		}
	};
	const add = (entry: TechniqueCatalogEntry, mode: TechniqueCatalogMode) => {
		if (adding) return;
		const match = matches.get(entry.key);
		if (match?.kind === "near" && match.technique?.id) {
			setAdding(true);
			setPending({
				entry,
				technique: { ...match.technique, id: match.technique.id },
				mode,
			});
		} else if (match?.kind !== "exact") {
			void save(entry, mode);
		}
	};
	const reviewAll = async (bulk: BulkAdd) => {
		setAdding(true);
		const linked = new Map(
			bulk.links.map((link) => [link.technique.id, link.entry.key]),
		);
		const results = matchCatalog(
			techniques.map((technique) =>
				technique.id && linked.has(technique.id)
					? { ...technique, curriculumKey: linked.get(technique.id) }
					: technique,
			),
			entries,
		);
		const additions = [...bulk.additions];
		for (const [index, entry] of entries.entries()) {
			if (
				additions.includes(entry) ||
				bulk.links.some((link) => link.entry.key === entry.key)
			)
				continue;
			const match = results[index];
			if (match.kind === "near" && match.technique?.id) {
				setPending({
					entry,
					technique: { ...match.technique, id: match.technique.id },
					mode: "later",
					bulk: {
						...bulk,
						additions,
					},
				});
				return;
			}
			if (match.kind !== "exact") additions.push(entry);
		}
		setPending(null);
		const ordered = entries.filter((entry) => additions.includes(entry));
		try {
			await addAllCatalog(
				ordered,
				ordered.map((entry) => catalogTitle(entry, t)),
				bulk.links.map(({ entry, technique, rename }) => ({
					id: technique.id,
					entry,
					rename,
					currentType: technique.type,
				})),
			);
		} catch {
			setError(t("technique.catalog.addAllError"));
		} finally {
			setAdding(false);
		}
	};
	const answer = (choice: "keep" | "rename" | "add") => {
		if (!pending) return;
		const { entry, technique, mode, bulk } = pending;
		const link = { entry, technique, rename: choice === "rename" };
		setPending(null);
		if (bulk) {
			void reviewAll({
				...bulk,
				n: bulk.n + 1,
				additions:
					choice === "add" ? [...bulk.additions, entry] : bulk.additions,
				links: choice === "add" ? bulk.links : [...bulk.links, link],
			});
		} else {
			void save(entry, mode, choice === "add" ? undefined : link);
		}
	};
	const footer =
		missing.length === 0 ? null : (
			<View style={{ gap: space.sm, marginTop: space.xl }}>
				<Button
					mode="outlined"
					disabled={adding}
					onPress={() => {
						if (adding) return;
						const total = missing.filter(
							(entry) => matches.get(entry.key)?.kind === "near",
						).length;
						void reviewAll({
							additions: [],
							links: [],
							n: 1,
							total,
							others: missing.length - total,
						});
					}}
				>
					{t("technique.catalog.addAll", { count: missing.length })}
				</Button>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("technique.catalog.addAllHint")}
				</Text>
			</View>
		);
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
					ListFooterComponent={
						<ScreenContent scroll={false} paddingTop={0}>
							{footer}
						</ScreenContent>
					}
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
					{footer}
				</ScreenContent>
			)}
			{pending && (
				<NearMatchDialog
					currentTitle={pending.technique.title}
					catalogTitle={catalogTitle(pending.entry, t)}
					progress={
						pending.bulk
							? {
									n: pending.bulk.n,
									total: pending.bulk.total,
									others: pending.bulk.others,
								}
							: undefined
					}
					onAnswer={answer}
					onDismiss={() => {
						setPending(null);
						setAdding(false);
					}}
				/>
			)}
			<ErrorSnackbar error={error} onDismiss={() => setError(null)} />
		</View>
	);
}
