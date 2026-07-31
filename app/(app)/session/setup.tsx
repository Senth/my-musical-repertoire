import { randomUUID } from "expo-crypto";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Appbar,
	Button,
	Card,
	Checkbox,
	Divider,
	Text,
	useTheme,
} from "react-native-paper";
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { usePieces } from "@/hooks/use-pieces";
import { useAllSections } from "@/hooks/use-sections";
import { useSessionPresets } from "@/hooks/use-session-presets";
import { useTechniques } from "@/hooks/use-techniques";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import type {
	ActiveSession,
	BlockExecutionState,
	MaintenanceOptIn,
	OmittedSlot,
	PlannedBlock,
	SessionPlan,
} from "@/models/session";
import {
	allocationFromLines,
	type PresetLines,
	SCRATCH_PRESET_ID,
} from "@/models/session-preset";
import { displayMinutes, minutesLabelKey } from "@/utils/format-minutes";
import { buildPlan, planTotalMinutes } from "@/utils/session-planner";
import { writeActiveSession } from "@/utils/session-storage";

/**
 * Preview and Start. The preset decides the minutes — this screen only resolves
 * it into an allocation, shows what the engine picked, and starts the session.
 */
export default function SessionSetupScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation("/(app)/(tabs)/overview");
	const { user } = useAuth();
	const params = useLocalSearchParams<{ presetId?: string }>();
	const presetId = params.presetId ?? SCRATCH_PRESET_ID;
	const isCustom = presetId === SCRATCH_PRESET_ID;

	const { pieces, loading: piecesLoading } = usePieces();
	const { sections, loading: sectionsLoading } = useAllSections();
	const { techniques, loading: techniquesLoading } = useTechniques();
	const { presets, scratch, loading: presetsLoading } = useSessionPresets();

	const [starting, setStarting] = useState<boolean>(false);
	// Screen state only — deciding fresh each session is the point.
	const [optInAccepted, setOptInAccepted] = useState<boolean>(false);

	const preset = useMemo(
		() =>
			isCustom ? scratch : (presets.find((p) => p.id === presetId) ?? null),
		[isCustom, scratch, presets, presetId],
	);

	const lines: PresetLines = useMemo(() => preset?.lines ?? {}, [preset]);
	const presetName = isCustom
		? t("screen.session.preset.customName")
		: (preset?.name ?? "");

	const allocation = useMemo(() => allocationFromLines(lines), [lines]);

	// The plan built from the allocation alone. Its `maintenanceOptIn` is the
	// offer shown below the preview; ticking it rebuilds the whole plan (the
	// leftover minutes handed to learning/stabilizing have to be taken back).
	const basePlan = useMemo(() => {
		if (piecesLoading || techniquesLoading || sectionsLoading || presetsLoading)
			return null;
		return buildPlan(allocation, pieces, sections, techniques, undefined, {
			presetId: isCustom ? null : presetId,
			presetName,
		});
	}, [
		allocation,
		pieces,
		sections,
		techniques,
		piecesLoading,
		techniquesLoading,
		sectionsLoading,
		presetsLoading,
		isCustom,
		presetId,
		presetName,
	]);

	// Any change to the allocation re-plans — the oversized piece may well be a
	// different one, so the tick never carries over.
	// biome-ignore lint/correctness/useExhaustiveDependencies: resets on re-plan
	useEffect(() => {
		setOptInAccepted(false);
	}, [allocation]);

	const optIn = basePlan?.maintenanceOptIn ?? null;

	const plan = useMemo(() => {
		if (!basePlan) return null;
		if (!optInAccepted || !optIn) return basePlan;
		return buildPlan(allocation, pieces, sections, techniques, undefined, {
			forcedMaintenancePieceId: optIn.pieceId,
			presetId: isCustom ? null : presetId,
			presetName,
		});
	}, [
		basePlan,
		optInAccepted,
		optIn,
		allocation,
		pieces,
		sections,
		techniques,
		isCustom,
		presetId,
		presetName,
	]);

	const handleStart = async () => {
		if (!user || !plan) return;
		setStarting(true);
		try {
			const blockStates: BlockExecutionState[] = plan.blocks.map((_, idx) => ({
				index: idx,
				status: idx === 0 ? "in-progress" : "pending",
				elapsedSeconds: 0,
				extendMinutes: 0,
			}));
			const active: ActiveSession = {
				plan,
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
		piecesLoading || sectionsLoading || techniquesLoading || presetsLoading;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction onPress={goBack} />
				<Appbar.Content title={presetName || t("screen.session.setup.title")} />
				<Appbar.Action
					icon="pencil"
					accessibilityLabel={t("screen.session.setup.edit")}
					onPress={() =>
						router.push(`/session/preset-editor?presetId=${presetId}` as const)
					}
				/>
			</Appbar.Header>
			{loading ? (
				<LoadingScreen />
			) : (
				<ScreenContent gap={6} paddingBottom={24}>
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
						{plan && plan.blocks.length > 0 ? <TotalRow plan={plan} /> : null}
					</View>

					{optIn ? (
						<OptInRow
							optIn={optIn}
							checked={optInAccepted}
							onToggle={() => setOptInAccepted((v) => !v)}
						/>
					) : null}

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
					minutes: displayMinutes(slot.redistributedMinutes).minutes,
				})}
			</Text>
		</View>
	);
}

/**
 * Closes the preview list so the plan reads as a receipt that adds up. Shows the
 * real total — allocated minutes plus whatever maintenance overran by — with a
 * `(+N)` suffix whenever the two differ.
 */
function TotalRow({ plan }: { plan: SessionPlan }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const inflation = plan.inflationMinutes ?? 0;
	const total = displayMinutes(planTotalMinutes(plan));
	const label =
		inflation > 0
			? t("screen.session.setup.totalInflated", {
					minutes: total.minutes,
					extra: displayMinutes(inflation).minutes,
				})
			: t(minutesLabelKey(total.approx), { minutes: total.minutes });

	return (
		<View className="gap-2">
			<Divider />
			<View className="flex-row items-start justify-between gap-3">
				<Text variant="bodyLarge" style={{ fontWeight: "600" }}>
					{t("screen.session.setup.totalLabel")}
				</Text>
				<Text
					variant="bodyLarge"
					style={{
						fontWeight: "600",
						color:
							inflation > 0 ? theme.colors.tertiary : theme.colors.onSurface,
					}}
				>
					{label}
				</Text>
			</View>
		</View>
	);
}

/**
 * The oversized-piece offer. A piece the planner can never fit is proposed as a
 * swap for the auto-picked maintenance group; the user decides whether the extra
 * minutes are worth it. Escalates visually once the piece goes stale.
 */
function OptInRow({
	optIn,
	checked,
	onToggle,
}: {
	optIn: MaintenanceOptIn;
	checked: boolean;
	onToggle: () => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const extra = displayMinutes(optIn.extraMinutes).minutes;
	const days = optIn.daysSinceLastPracticed;
	const staleLabel =
		days >= 21
			? t("screen.session.setup.optIn.staleWeeks")
			: days >= 14
				? t("screen.session.setup.optIn.staleDays", { days })
				: null;

	return (
		<View className="gap-1">
			<Checkbox.Item
				mode="android"
				position="leading"
				status={checked ? "checked" : "unchecked"}
				onPress={onToggle}
				label={t("screen.session.setup.optIn.label", { piece: optIn.title })}
				// Checkbox.Item takes no `accessibilityHint`, so the consequence of
				// ticking it is spelled out in the label the screen reader announces.
				accessibilityLabel={t("screen.session.setup.optIn.a11y", {
					piece: optIn.title,
					minutes: extra,
				})}
				style={{ paddingHorizontal: 0 }}
			/>
			<View className="flex-row items-center gap-2" style={{ paddingLeft: 48 }}>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.session.setup.optIn.extra", { minutes: extra })}
				</Text>
				{staleLabel ? (
					<View
						style={{
							backgroundColor: theme.colors.tertiaryContainer,
							borderRadius: 8,
							paddingHorizontal: 8,
							paddingVertical: 2,
						}}
					>
						<Text
							variant="bodySmall"
							style={{ color: theme.colors.onTertiaryContainer }}
						>
							{staleLabel}
						</Text>
					</View>
				) : null}
			</View>
		</View>
	);
}

function PreviewRow({ block }: { block: PlannedBlock }) {
	const { t } = useTranslation();
	const theme = useTheme();
	const kindLabel = t(`screen.session.block.${block.kind}` as const);
	const shown = displayMinutes(block.allocatedMinutes);
	const minutesLabel = t(minutesLabelKey(shown.approx), {
		minutes: shown.minutes,
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
