import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Appbar, Button, Divider, Text, useTheme } from "react-native-paper";
import { LoadingScreen } from "@/components/ui/CenteredScreen";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/hooks/use-active-session";
import type { BlockExecutionState, PlannedBlock } from "@/models/session";
import { clearActiveSession } from "@/utils/session-storage";

export default function SessionSummaryScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { user } = useAuth();
	const { session, loaded } = useActiveSession(user);

	const handleDone = async () => {
		if (user) {
			await clearActiveSession(user.uid);
		}
		router.replace("/(app)/(tabs)/overview");
	};

	if (!loaded) {
		return <LoadingScreen />;
	}

	if (!session) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<Button mode="contained" onPress={handleDone}>
					{t("screen.session.summary.done")}
				</Button>
			</View>
		);
	}

	const totalMinutes = session.plan.totalMinutes;
	const practicedSeconds = session.blockStates
		.filter((b) => b.status === "completed")
		.reduce((acc, b) => acc + b.elapsedSeconds, 0);
	const practicedMinutes = Math.round(practicedSeconds / 60);
	const blocksDone = session.blockStates.filter(
		(b) => b.status === "completed",
	).length;
	const blocksSkipped = session.blockStates.filter(
		(b) => b.status === "skipped",
	).length;
	const totalBlocks = session.plan.blocks.length;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.Content title={t("screen.session.summary.title")} />
			</Appbar.Header>
			<ScreenContent gap={4} paddingBottom={24}>
				<Text variant="bodyLarge">
					{t("screen.session.summary.totalPracticed", {
						practiced: practicedMinutes,
						total: totalMinutes,
					})}
				</Text>
				<Text variant="bodyLarge">
					{t("screen.session.summary.blocksDone", {
						done: blocksDone,
						total: totalBlocks,
					})}
					{blocksSkipped > 0
						? t("screen.session.summary.blocksSkipped", {
								skipped: blocksSkipped,
							})
						: ""}
				</Text>

				<Divider />

				<Text variant="titleSmall">
					{t("screen.session.summary.whatYouPracticed")}
				</Text>

				{session.plan.blocks.map((block, idx) => {
					const k = `${block.kind}:${block.pieceId ?? ""}:${block.sectionId ?? ""}:${block.techniqueId ?? ""}:${block.allocatedMinutes}`;
					return (
						<SummaryRow
							key={k}
							block={block}
							state={session.blockStates[idx]}
						/>
					);
				})}

				<Button mode="contained" onPress={handleDone}>
					{t("screen.session.summary.done")}
				</Button>
			</ScreenContent>
		</View>
	);
}

function SummaryRow({
	block,
	state,
}: {
	block: PlannedBlock;
	state: BlockExecutionState | undefined;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const skipped = state?.status === "skipped";
	const completed = state?.status === "completed";
	const actualMinutes = state ? Math.round(state.elapsedSeconds / 60) : 0;
	const kindLabel = t(`screen.session.block.${block.kind}` as const);
	const subtitle = [block.title, block.subtitle]
		.filter((x): x is string => !!x)
		.join(" / ");

	return (
		<View className="flex-row items-start gap-2">
			<Text style={{ width: 20 }}>{skipped ? "⤬" : completed ? "✓" : "·"}</Text>
			<View className="flex-1">
				<Text variant="bodyLarge">
					{kindLabel}
					{!skipped && actualMinutes > 0
						? `  ${t("screen.session.block.minutes", { minutes: actualMinutes })}`
						: ""}
					{skipped ? `  ${t("screen.session.summary.skipped")}` : ""}
				</Text>
				{subtitle ? (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{subtitle}
					</Text>
				) : null}
			</View>
		</View>
	);
}
