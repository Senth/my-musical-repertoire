import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Appbar, Text } from "react-native-paper";
import type { PracticeHeading } from "@/contexts/CoachContext";
import type { BlockExecutionState, PlannedBlock } from "@/models/session";
import { useAppTheme } from "@/theme";
import { coachSegments } from "@/utils/coach-progress";

export interface CoachShellProps {
	blocks: PlannedBlock[];
	blockStates: BlockExecutionState[];
	sessionElapsedSeconds: number;
	sessionTotalSeconds: number;
	blockElapsedSeconds: number;
	blockTotalSeconds: number;
	heading: PracticeHeading | null;
	onExit: () => void;
	children: ReactNode;
}

export function formatMMSS(seconds: number): string {
	const sign = seconds < 0 ? "-" : "";
	const abs = Math.abs(Math.round(seconds));
	const m = Math.floor(abs / 60);
	const s = abs % 60;
	return `${sign}${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The title and subtitle a practice screen carries in its app bar, shared by
 * the coach shell and the standalone practice screens. Paper 5.15's
 * `Appbar.Content` only renders `subtitle` under the v2 theme, so the pair is
 * passed as the title node, each line truncating to one.
 */
export function PracticeAppbarContent({
	heading,
}: {
	heading: PracticeHeading | null;
}) {
	const theme = useAppTheme();
	if (!heading) return <Appbar.Content title="" />;
	return (
		<Appbar.Content
			title={
				<View>
					<Text
						variant="titleMedium"
						numberOfLines={1}
						accessibilityRole="header"
					>
						{heading.title}
					</Text>
					{heading.subtitle ? (
						<Text
							variant="bodySmall"
							numberOfLines={1}
							style={{ color: theme.colors.onSurfaceVariant }}
						>
							{heading.subtitle}
						</Text>
					) : null}
				</View>
			}
		/>
	);
}

/**
 * The strip above the block body: back action, the two time rows right-aligned
 * in the app bar, and one segmented bar — one segment per block, drawn to its
 * real length. Read-only; the body beneath owns every control.
 */
export function CoachShell({
	blocks,
	blockStates,
	sessionElapsedSeconds,
	sessionTotalSeconds,
	blockElapsedSeconds,
	blockTotalSeconds,
	heading,
	onExit,
	children,
}: CoachShellProps) {
	const { t } = useTranslation();
	const theme = useAppTheme();

	const sessionOver = sessionElapsedSeconds > sessionTotalSeconds;
	const segments = coachSegments(blocks, blockStates, blockElapsedSeconds);
	const blockOver = blockElapsedSeconds > blockTotalSeconds;

	return (
		<View style={{ flex: 1, backgroundColor: theme.colors.background }}>
			<Appbar.Header>
				<Appbar.BackAction
					onPress={onExit}
					accessibilityLabel={t("screen.session.resume.end")}
				/>
				<PracticeAppbarContent heading={heading} />
				<View style={{ alignItems: "flex-end", paddingRight: 4 }}>
					<Text
						variant="labelMedium"
						style={{
							color: sessionOver
								? theme.colors.warning
								: theme.colors.onSurfaceVariant,
						}}
					>
						{sessionOver
							? t("screen.session.coach.timeOver", {
									elapsed: formatMMSS(sessionElapsedSeconds),
									time: formatMMSS(sessionElapsedSeconds - sessionTotalSeconds),
								})
							: t("screen.session.coach.timeLeft", {
									elapsed: formatMMSS(sessionElapsedSeconds),
									time: formatMMSS(sessionTotalSeconds - sessionElapsedSeconds),
								})}
					</Text>
					<Text
						variant="labelMedium"
						style={{
							color: blockOver
								? theme.colors.warning
								: theme.colors.onSurfaceVariant,
						}}
					>
						{blockOver
							? t("screen.session.coach.timeOver", {
									elapsed: formatMMSS(blockElapsedSeconds),
									time: formatMMSS(blockElapsedSeconds - blockTotalSeconds),
								})
							: t("screen.session.coach.timeLeft", {
									elapsed: formatMMSS(blockElapsedSeconds),
									time: formatMMSS(
										Math.max(0, blockTotalSeconds - blockElapsedSeconds),
									),
								})}
					</Text>
				</View>
			</Appbar.Header>

			<View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
				<View style={{ flexDirection: "row", gap: 3, height: 6 }}>
					{segments.map((segment) => (
						<View
							key={segment.id}
							style={{
								flex: Math.max(segment.minutes, 0.5),
								height: 6,
								borderRadius: 3,
								backgroundColor: theme.colors.outlineVariant,
								overflow: "hidden",
							}}
						>
							{segment.fill > 0 && (
								<View
									style={{
										width: `${segment.fill * 100}%`,
										height: "100%",
										backgroundColor: theme.colors.primary,
									}}
								/>
							)}
							{segment.over > 0 && (
								<View
									style={{
										position: "absolute",
										left: 0,
										top: 0,
										bottom: 0,
										width: `${segment.over * 100}%`,
										backgroundColor: theme.colors.warning,
									}}
								/>
							)}
						</View>
					))}
				</View>
			</View>

			<View style={{ flex: 1 }}>{children}</View>
		</View>
	);
}
