import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import type { MD3Theme } from "react-native-paper";
import { Appbar, Text, useTheme } from "react-native-paper";
import type { BlockExecutionState, PlannedBlock } from "@/models/session";
import { coachSegments } from "@/utils/coach-progress";

type AppTheme = MD3Theme & {
	colors: MD3Theme["colors"] & {
		warning: string;
	};
};

export interface CoachShellProps {
	blocks: PlannedBlock[];
	blockStates: BlockExecutionState[];
	sessionElapsedSeconds: number;
	sessionTotalSeconds: number;
	blockElapsedSeconds: number;
	blockTotalSeconds: number;
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
	onExit,
	children,
}: CoachShellProps) {
	const { t } = useTranslation();
	const theme = useTheme<AppTheme>();

	const sessionRemaining = Math.max(
		0,
		sessionTotalSeconds - sessionElapsedSeconds,
	);
	const segments = coachSegments(blocks, blockStates, blockElapsedSeconds);
	const blockOver = blockElapsedSeconds > blockTotalSeconds;

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header>
				<Appbar.BackAction
					onPress={onExit}
					accessibilityLabel={t("screen.session.resume.end")}
				/>
				<Appbar.Content title="" />
				<View style={{ alignItems: "flex-end", paddingRight: 4 }}>
					<Text
						variant="labelMedium"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.session.coach.timeLeft", {
							elapsed: formatMMSS(sessionElapsedSeconds),
							time: formatMMSS(sessionRemaining),
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

			<View className="flex-1">{children}</View>
		</View>
	);
}
