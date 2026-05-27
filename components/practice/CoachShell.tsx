import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Appbar,
	Button,
	IconButton,
	ProgressBar,
	Text,
	useTheme,
} from "react-native-paper";
import type { PlannedBlock } from "@/models/session";

export interface CoachShellProps {
	currentBlock: PlannedBlock | null;
	currentBlockIndex: number;
	totalBlocks: number;
	sessionElapsedSeconds: number;
	sessionTotalSeconds: number;
	blockElapsedSeconds: number;
	blockTotalSeconds: number;
	saving: boolean;
	onSaveAndNext: () => void;
	onSkip: () => void;
	onExtend: () => void;
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

export function CoachShell({
	currentBlock,
	currentBlockIndex,
	totalBlocks,
	sessionElapsedSeconds,
	sessionTotalSeconds,
	blockElapsedSeconds,
	blockTotalSeconds,
	saving,
	onSaveAndNext,
	onSkip,
	onExtend,
	onExit,
	children,
}: CoachShellProps) {
	const { t } = useTranslation();
	const theme = useTheme();

	const sessionRemaining = sessionTotalSeconds - sessionElapsedSeconds;
	const blockRemaining = blockTotalSeconds - blockElapsedSeconds;
	const sessionProgress = Math.min(
		1,
		Math.max(0, sessionElapsedSeconds / Math.max(1, sessionTotalSeconds)),
	);
	const blockProgress = Math.min(
		1,
		Math.max(0, blockElapsedSeconds / Math.max(1, blockTotalSeconds)),
	);
	const blockWarn = blockRemaining < 0;

	const blockKindLabel = currentBlock
		? t(`screen.session.block.${currentBlock.kind}` as const)
		: "";
	const blockTitle = currentBlock?.title ?? blockKindLabel;

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
				<Appbar.Content title={t("screen.session.coach.title")} />
			</Appbar.Header>

			<View
				style={{
					paddingHorizontal: 16,
					paddingTop: 8,
					paddingBottom: 8,
					backgroundColor: theme.colors.surfaceVariant,
				}}
			>
				<View className="flex-row items-center justify-between">
					<Text variant="labelMedium">
						{t("screen.session.coach.sessionLabel")}
					</Text>
					<Text variant="labelMedium">
						{formatMMSS(sessionElapsedSeconds)} {formatMMSS(-sessionRemaining)}
					</Text>
				</View>
				<View style={{ marginTop: 4, marginBottom: 8 }}>
					<ProgressBar
						progress={sessionProgress}
						color={theme.colors.primary}
					/>
				</View>
				<View className="flex-row items-center justify-between">
					<Text variant="labelMedium">
						{t("screen.session.coach.blockLabel", {
							current: currentBlockIndex + 1,
							total: totalBlocks,
						})}
						{"  "}
						{blockTitle}
					</Text>
					<Text
						variant="labelMedium"
						style={{
							color: blockWarn ? theme.colors.error : theme.colors.onSurface,
						}}
					>
						{formatMMSS(blockElapsedSeconds)} {formatMMSS(-blockRemaining)}
					</Text>
				</View>
				<View style={{ marginTop: 4 }}>
					<ProgressBar
						progress={blockProgress}
						color={blockWarn ? theme.colors.error : theme.colors.primary}
					/>
				</View>
			</View>

			<View className="flex-1">{children}</View>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					paddingHorizontal: 16,
					paddingVertical: 12,
					borderTopWidth: 1,
					borderTopColor: theme.colors.outlineVariant,
					backgroundColor: theme.colors.background,
				}}
			>
				<IconButton
					mode="contained-tonal"
					icon="skip-next"
					onPress={onSkip}
					accessibilityLabel={t("screen.session.coach.skip")}
				/>
				<IconButton
					mode="contained-tonal"
					icon="plus"
					onPress={onExtend}
					accessibilityLabel={t("screen.session.coach.extend")}
				/>
				<View style={{ flex: 1 }}>
					<Button
						mode="contained"
						onPress={onSaveAndNext}
						loading={saving}
						disabled={saving}
					>
						{t("screen.session.coach.saveAndNext")}
					</Button>
				</View>
			</View>
		</View>
	);
}
