import Slider from "@react-native-community/slider";
import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Appbar,
	Button,
	Card,
	Chip,
	Divider,
	Switch,
	Text,
	useTheme,
} from "react-native-paper";
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import { useTechniques } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	type ActiveSession,
	type BlockExecutionState,
	FOCUS_BY_EMPHASIS,
	type OmittedSlot,
	type PlannedBlock,
	SESSION_EMPHASES,
	type SessionEmphasis,
	type SessionInputs,
} from "@/models/session";
import { buildPlan } from "@/utils/session-planner";
import {
	readSessionInputs,
	writeActiveSession,
	writeSessionInputs,
} from "@/utils/session-storage";

const MIN_MINUTES = 15;
const MAX_MINUTES = 90;
const STEP_MINUTES = 5;

function isEmphasis(value: unknown): value is SessionEmphasis {
	return (
		typeof value === "string" && (SESSION_EMPHASES as string[]).includes(value)
	);
}

export default function SessionSetupScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation("/(app)/(tabs)/overview");
	const { user } = useAuth();
	const params = useLocalSearchParams<{ emphasis?: string }>();
	const emphasis: SessionEmphasis = isEmphasis(params.emphasis)
		? params.emphasis
		: "balanced";

	const { pieces, loading: piecesLoading } = usePieces();
	const { sections, loading: sectionsLoading } = useAllSections();
	const { techniques, loading: techniquesLoading } = useTechniques();

	const focus = FOCUS_BY_EMPHASIS[emphasis];

	const [totalMinutes, setTotalMinutes] = useState<number>(30);
	const [techniqueEnabled, setTechniqueEnabled] = useState<boolean>(true);
	const [sightReadingEnabled, setSightReadingEnabled] = useState<boolean>(true);
	const [repertoireEnabled, setRepertoireEnabled] = useState<boolean>(true);
	const [restored, setRestored] = useState<boolean>(false);
	const [starting, setStarting] = useState<boolean>(false);

	useEffect(() => {
		let active = true;
		(async () => {
			if (!user) {
				setRestored(true);
				return;
			}
			const stored = await readSessionInputs(user.uid, emphasis);
			if (!active) return;
			if (stored) {
				setTotalMinutes(stored.totalMinutes);
				setTechniqueEnabled(stored.techniqueEnabled);
				setSightReadingEnabled(stored.sightReadingEnabled);
				// Older stored inputs predate the repertoire toggle → default on.
				setRepertoireEnabled(stored.repertoireEnabled ?? true);
			}
			setRestored(true);
		})();
		return () => {
			active = false;
		};
	}, [user, emphasis]);

	// The focused category is always included regardless of the stored toggle.
	const inputs: SessionInputs = useMemo(
		() => ({
			emphasis,
			totalMinutes,
			techniqueEnabled: focus === "technique" ? true : techniqueEnabled,
			sightReadingEnabled:
				focus === "sightReading" ? true : sightReadingEnabled,
			repertoireEnabled: focus === "repertoire" ? true : repertoireEnabled,
		}),
		[
			emphasis,
			focus,
			totalMinutes,
			techniqueEnabled,
			sightReadingEnabled,
			repertoireEnabled,
		],
	);

	const plan = useMemo(() => {
		if (piecesLoading || techniquesLoading || sectionsLoading) return null;
		return buildPlan(inputs, pieces, sections, techniques);
	}, [
		inputs,
		pieces,
		sections,
		techniques,
		piecesLoading,
		techniquesLoading,
		sectionsLoading,
	]);

	const handleStart = async () => {
		if (!user || !plan) return;
		setStarting(true);
		try {
			await writeSessionInputs(user.uid, inputs);
			const blockStates: BlockExecutionState[] = plan.blocks.map((_, idx) => ({
				index: idx,
				status: idx === 0 ? "in-progress" : "pending",
				elapsedSeconds: 0,
				extendMinutes: 0,
			}));
			const active: ActiveSession = {
				plan,
				inputs,
				startedAt: new Date().toISOString(),
				sessionId: randomUUID(),
				currentBlockIndex: 0,
				blockStates,
				sessionElapsedSeconds: 0,
				currentBlockStartedAt: new Date().toISOString(),
			};
			await writeActiveSession(user.uid, active);
			router.replace("/session/coach");
		} finally {
			setStarting(false);
		}
	};

	const loading =
		piecesLoading || sectionsLoading || techniquesLoading || !restored;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={goBack} />
				<Appbar.Content title={t("screen.session.setup.title")} />
			</Appbar.Header>
			{loading ? (
				<LoadingScreen />
			) : (
				<ScreenContent gap={6} paddingBottom={24}>
					<View className="gap-2">
						<Text variant="titleSmall">
							{t("screen.session.setup.emphasisLabel")}
						</Text>
						<Chip
							icon="tune"
							style={{ alignSelf: "flex-start" }}
							onPress={goBack}
							accessibilityLabel={t(
								`screen.session.emphasis.${emphasis}` as const,
							)}
						>
							{t(`screen.session.emphasis.${emphasis}` as const)}
						</Chip>
					</View>

					<View className="gap-2">
						<View className="flex-row items-center justify-between">
							<Text variant="titleSmall">
								{t("screen.session.setup.minutesLabel")}
							</Text>
							<Text variant="titleMedium">
								{t("screen.session.setup.minutesValue", {
									minutes: totalMinutes,
								})}
							</Text>
						</View>
						<Slider
							minimumValue={MIN_MINUTES}
							maximumValue={MAX_MINUTES}
							step={STEP_MINUTES}
							value={totalMinutes}
							onValueChange={(v) => setTotalMinutes(Math.round(v))}
							minimumTrackTintColor={theme.colors.primary}
							maximumTrackTintColor={theme.colors.surfaceVariant}
							thumbTintColor={theme.colors.primary}
						/>
					</View>

					{focus !== "technique" && (
						<View className="flex-row items-center justify-between">
							<Text variant="titleSmall">
								{t("screen.session.setup.techniqueLabel")}
							</Text>
							<Switch
								value={techniqueEnabled}
								onValueChange={setTechniqueEnabled}
							/>
						</View>
					)}

					{focus !== "sightReading" && (
						<View className="flex-row items-center justify-between">
							<Text variant="titleSmall">
								{t("screen.session.setup.sightReadingLabel")}
							</Text>
							<Switch
								value={sightReadingEnabled}
								onValueChange={setSightReadingEnabled}
							/>
						</View>
					)}

					{focus !== "repertoire" && (
						<View className="flex-row items-center justify-between">
							<Text variant="titleSmall">
								{t("screen.session.setup.repertoireLabel")}
							</Text>
							<Switch
								value={repertoireEnabled}
								onValueChange={setRepertoireEnabled}
							/>
						</View>
					)}

					<Divider />

					<View className="gap-2">
						<Text variant="titleSmall">
							{t("screen.session.setup.preview")}
						</Text>
						{plan && plan.blocks.length > 0 ? (
							plan.blocks.map((block) => (
								<PreviewRow
									key={`${block.kind}:${block.pieceId ?? ""}:${block.sectionId ?? ""}:${block.techniqueId ?? ""}:${block.allocatedMinutes}`}
									block={block}
								/>
							))
						) : (
							<Card mode="contained">
								<Card.Content>
									<Text variant="bodyMedium">
										{t("screen.session.setup.noContent")}
									</Text>
								</Card.Content>
							</Card>
						)}
						{plan?.omitted
							?.filter((o) => o.reason === "practiced-today")
							.map((o) => (
								<OmittedRow key={`omitted:${o.kind}`} slot={o} />
							))}
					</View>

					<Button
						mode="contained"
						onPress={handleStart}
						loading={starting}
						disabled={starting || !plan || plan.blocks.length === 0}
					>
						{t("screen.session.setup.start")}
					</Button>
				</ScreenContent>
			)}
		</View>
	);
}

function OmittedRow({ slot }: { slot: OmittedSlot }) {
	const { t } = useTranslation();
	const theme = useTheme();
	return (
		<View className="flex-row items-start gap-3">
			<Text
				variant="bodyMedium"
				style={{ color: theme.colors.onSurfaceVariant, fontStyle: "italic" }}
			>
				{t(`screen.session.setup.allPracticedToday.${slot.kind}` as const, {
					minutes: slot.redistributedMinutes,
				})}
			</Text>
		</View>
	);
}

function PreviewRow({ block }: { block: PlannedBlock }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const kindLabel = t(`screen.session.block.${block.kind}` as const);
	const minutesLabel = t("screen.session.block.minutes", {
		minutes: block.allocatedMinutes,
	});
	const subtitleParts = [block.title, block.subtitle]
		.filter((x): x is string => !!x)
		.join(" / ");

	return (
		<View className="flex-row items-start justify-between gap-3">
			<View className="flex-1">
				<Text variant="bodyLarge">{kindLabel}</Text>
				{subtitleParts ? (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{subtitleParts}
					</Text>
				) : null}
			</View>
			<Text variant="bodyLarge">{minutesLabel}</Text>
		</View>
	);
}
