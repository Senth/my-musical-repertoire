import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	ActivityIndicator,
	Button,
	Dialog,
	HelperText,
	Portal,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { PiecePracticeContent } from "@/app/(app)/piece/[id]/practice";
import { TechniquePracticeContent } from "@/app/(app)/technique/[id]/practice";
import { CoachShell, formatMMSS } from "@/components/practice/CoachShell";
import { SightReadingBlockBody } from "@/components/practice/SightReadingBlockBody";
import { useAuth } from "@/contexts/AuthContext";
import { type CoachContextValue, CoachProvider } from "@/contexts/CoachContext";
import { usePieces, useUpdatePiece } from "@/hooks/use-pieces";
import type {
	ActiveSession,
	BlockExecutionState,
	PlannedBlock,
} from "@/models/session";
import { playBlockEndCue } from "@/utils/session-cue";
import { readActiveSession, writeActiveSession } from "@/utils/session-storage";

const TICK_MS = 1000;

function diffSec(fromIso: string | null | undefined): number {
	if (!fromIso) return 0;
	const t = new Date(fromIso).getTime();
	if (Number.isNaN(t)) return 0;
	return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

export default function CoachScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { user } = useAuth();
	const { pieces } = usePieces();
	const { updatePiece } = useUpdatePiece();
	const [session, setSession] = useState<ActiveSession | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [saving, setSaving] = useState(false);
	const [durationPrompt, setDurationPrompt] = useState<{
		pieceId: string;
		title: string;
		elapsedSeconds: number;
	} | null>(null);
	const [, setTick] = useState(0);
	const cueFiredForIndexRef = useRef<Set<number>>(new Set());

	const saveHandlerRef = useRef<(() => Promise<{ saved: boolean }>) | null>(
		null,
	);
	const validateHandlerRef = useRef<(() => boolean) | null>(null);
	const sightReadingStopRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		let active = true;
		(async () => {
			if (!user) {
				setLoaded(true);
				return;
			}
			const s = await readActiveSession(user.uid);
			if (!active) return;
			setSession(s);
			setLoaded(true);
		})();
		return () => {
			active = false;
		};
	}, [user]);

	useEffect(() => {
		const id = setInterval(() => {
			setTick((v) => v + 1);
		}, TICK_MS);
		return () => clearInterval(id);
	}, []);

	// Redirect when no active session and load complete
	useFocusEffect(
		useCallback(() => {
			if (loaded && !session) {
				router.replace("/(app)/(tabs)/overview");
			}
		}, [loaded, session, router]),
	);

	const persist = useCallback(
		async (next: ActiveSession) => {
			if (!user) return;
			await writeActiveSession(user.uid, next);
		},
		[user],
	);

	const currentBlock: PlannedBlock | null = useMemo(() => {
		if (!session) return null;
		return session.plan.blocks[session.currentBlockIndex] ?? null;
	}, [session]);

	const currentBlockState: BlockExecutionState | null = useMemo(() => {
		if (!session) return null;
		return session.blockStates[session.currentBlockIndex] ?? null;
	}, [session]);

	const sessionElapsedSeconds = session ? diffSec(session.startedAt) : 0;
	const sessionTotalSeconds = session ? session.plan.totalMinutes * 60 : 0;
	const blockElapsedSeconds = session
		? diffSec(session.currentBlockStartedAt)
		: 0;
	const blockTotalSeconds =
		currentBlock && currentBlockState
			? (currentBlock.allocatedMinutes + currentBlockState.extendMinutes) * 60
			: 0;

	// Play cue once when block timer first hits 0
	useEffect(() => {
		if (!session || !currentBlock || !currentBlockState) return;
		const idx = session.currentBlockIndex;
		if (blockTotalSeconds > 0 && blockElapsedSeconds >= blockTotalSeconds) {
			if (!cueFiredForIndexRef.current.has(idx)) {
				cueFiredForIndexRef.current.add(idx);
				playBlockEndCue();
			}
		}
	}, [
		blockElapsedSeconds,
		blockTotalSeconds,
		session,
		currentBlock,
		currentBlockState,
	]);

	const advance = useCallback(
		async (markStatus: "completed" | "skipped") => {
			if (!session || !currentBlockState) return;
			sightReadingStopRef.current?.();
			const idx = session.currentBlockIndex;
			const updatedBlockStates = session.blockStates.map((s, i) =>
				i === idx
					? {
							...s,
							status: markStatus,
							elapsedSeconds: diffSec(session.currentBlockStartedAt),
						}
					: s,
			);
			const nextIndex = idx + 1;
			const isDone = nextIndex >= session.plan.blocks.length;
			let nextSession: ActiveSession;
			if (isDone) {
				nextSession = {
					...session,
					currentBlockIndex: idx,
					blockStates: updatedBlockStates,
					sessionElapsedSeconds: diffSec(session.startedAt),
					currentBlockStartedAt: null,
				};
				setSession(nextSession);
				await persist(nextSession);
				router.replace("/session/summary");
				return;
			}
			updatedBlockStates[nextIndex] = {
				...updatedBlockStates[nextIndex],
				status: "in-progress",
			};
			nextSession = {
				...session,
				currentBlockIndex: nextIndex,
				blockStates: updatedBlockStates,
				currentBlockStartedAt: new Date().toISOString(),
				sessionElapsedSeconds: diffSec(session.startedAt),
			};
			setSession(nextSession);
			await persist(nextSession);
		},
		[session, currentBlockState, persist, router],
	);

	const handleSaveAndNext = useCallback(async () => {
		if (!session || !currentBlock) return;
		setSaving(true);
		try {
			const saver = saveHandlerRef.current;
			if (saver) {
				const result = await saver();
				if (!result.saved) {
					return;
				}
			}
			// Maintenance whole-piece block with no known duration → capture it
			// from the elapsed play-through time before advancing.
			if (
				currentBlock.kind === "repertoire-maintenance" &&
				currentBlock.pieceId
			) {
				const piece = pieces.find((p) => p.id === currentBlock.pieceId);
				if (piece && piece.durationSeconds == null) {
					setDurationPrompt({
						pieceId: currentBlock.pieceId,
						title: currentBlock.title ?? piece.title,
						elapsedSeconds: diffSec(session.currentBlockStartedAt),
					});
					return;
				}
			}
			await advance("completed");
		} finally {
			setSaving(false);
		}
	}, [session, currentBlock, advance, pieces]);

	const handleDurationSave = useCallback(
		async (minutes: number) => {
			const prompt = durationPrompt;
			setDurationPrompt(null);
			if (prompt) {
				try {
					await updatePiece(prompt.pieceId, {
						durationSeconds: minutes * 60,
					});
				} catch {
					// Non-fatal: still advance even if the duration write fails.
				}
			}
			await advance("completed");
		},
		[durationPrompt, updatePiece, advance],
	);

	const handleDurationSkip = useCallback(async () => {
		setDurationPrompt(null);
		await advance("completed");
	}, [advance]);

	const handleSkip = useCallback(async () => {
		await advance("skipped");
	}, [advance]);

	const handleExtend = useCallback(async () => {
		if (!session || !currentBlockState) return;
		const idx = session.currentBlockIndex;
		const updated = session.blockStates.map((s, i) =>
			i === idx ? { ...s, extendMinutes: s.extendMinutes + 2 } : s,
		);
		const next = { ...session, blockStates: updated };
		setSession(next);
		await persist(next);
	}, [session, currentBlockState, persist]);

	const handleExit = useCallback(() => {
		router.replace("/(app)/(tabs)/overview");
	}, [router]);

	const coachValue: CoachContextValue = useMemo(
		() => ({
			inCoach: true,
			sessionId: session?.sessionId ?? null,
			saveHandlerRef,
			validateHandlerRef,
		}),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[session?.sessionId],
	);

	if (!loaded) {
		return (
			<View
				className="flex-1 items-center justify-center"
				style={{ backgroundColor: theme.colors.background }}
			>
				<ActivityIndicator size="large" />
			</View>
		);
	}

	if (!session || !currentBlock) {
		return null;
	}

	let body: React.ReactNode;
	switch (currentBlock.kind) {
		case "warmup":
			if (currentBlock.techniqueId) {
				body = (
					<TechniquePracticeContent
						key={session.currentBlockIndex}
						techniqueId={currentBlock.techniqueId}
					/>
				);
			} else {
				body = (
					<FreeformBlockBody label={t("screen.session.coach.warmupBody")} />
				);
			}
			break;
		case "technique":
			if (currentBlock.techniqueId) {
				body = (
					<TechniquePracticeContent
						key={session.currentBlockIndex}
						techniqueId={currentBlock.techniqueId}
					/>
				);
			} else {
				body = (
					<FreeformBlockBody label={t("screen.session.coach.warmupBody")} />
				);
			}
			break;
		case "sight-reading":
			body = (
				<SightReadingBlockBody
					key={session.currentBlockIndex}
					stopRef={sightReadingStopRef}
				/>
			);
			break;
		case "repertoire-learning":
		case "repertoire-stabilizing":
		case "repertoire-maintenance": {
			if (currentBlock.pieceId) {
				body = (
					<PiecePracticeContent
						key={session.currentBlockIndex}
						pieceId={currentBlock.pieceId}
						sectionId={currentBlock.sectionId ?? null}
						triggerOverride="session-coach"
					/>
				);
			} else {
				body = <FreeformBlockBody label="" />;
			}
			break;
		}
	}

	return (
		<CoachProvider
			inCoach={coachValue.inCoach}
			sessionId={coachValue.sessionId}
			saveHandlerRef={coachValue.saveHandlerRef}
			validateHandlerRef={coachValue.validateHandlerRef}
		>
			<CoachShell
				currentBlock={currentBlock}
				currentBlockIndex={session.currentBlockIndex}
				totalBlocks={session.plan.blocks.length}
				sessionElapsedSeconds={sessionElapsedSeconds}
				sessionTotalSeconds={sessionTotalSeconds}
				blockElapsedSeconds={blockElapsedSeconds}
				blockTotalSeconds={blockTotalSeconds}
				saving={saving}
				onSaveAndNext={handleSaveAndNext}
				onSkip={handleSkip}
				onExtend={handleExtend}
				onExit={handleExit}
			>
				{body}
			</CoachShell>
			<DurationPromptDialog
				visible={!!durationPrompt}
				title={durationPrompt?.title ?? ""}
				elapsedSeconds={durationPrompt?.elapsedSeconds ?? 0}
				onSave={handleDurationSave}
				onSkip={handleDurationSkip}
			/>
		</CoachProvider>
	);
}

function DurationPromptDialog({
	visible,
	title,
	elapsedSeconds,
	onSave,
	onSkip,
}: {
	visible: boolean;
	title: string;
	elapsedSeconds: number;
	onSave: (minutes: number) => void;
	onSkip: () => void;
}) {
	const { t } = useTranslation();
	const [minutesText, setMinutesText] = useState("");

	useEffect(() => {
		if (visible) {
			setMinutesText(String(Math.max(1, Math.round(elapsedSeconds / 60))));
		}
	}, [visible, elapsedSeconds]);

	const minutes = Number.parseInt(minutesText.trim(), 10);
	const valid = !Number.isNaN(minutes) && minutes >= 1;

	return (
		<Portal>
			<Dialog visible={visible} onDismiss={onSkip}>
				<Dialog.Title>
					{t("screen.session.coach.durationPrompt.title", { piece: title })}
				</Dialog.Title>
				<Dialog.Content>
					<Text variant="bodyMedium">
						{t("screen.session.coach.durationPrompt.measured", {
							time: formatMMSS(elapsedSeconds),
						})}
					</Text>
					<TextInput
						label={t("screen.session.coach.durationPrompt.minutesLabel")}
						value={minutesText}
						onChangeText={setMinutesText}
						mode="outlined"
						keyboardType="numeric"
						error={!valid}
						style={{ marginTop: 12 }}
					/>
					<HelperText type="error" visible={!valid}>
						{t("screen.session.coach.durationPrompt.invalid")}
					</HelperText>
				</Dialog.Content>
				<Dialog.Actions>
					<Button
						onPress={onSkip}
						accessibilityLabel={t(
							"screen.session.coach.durationPrompt.skipA11y",
						)}
					>
						{t("screen.session.coach.durationPrompt.skip")}
					</Button>
					<Button
						onPress={() => onSave(minutes)}
						disabled={!valid}
						accessibilityLabel={t(
							"screen.session.coach.durationPrompt.saveA11y",
						)}
					>
						{t("screen.session.coach.durationPrompt.save")}
					</Button>
				</Dialog.Actions>
			</Dialog>
		</Portal>
	);
}

function FreeformBlockBody({ label }: { label: string }) {
	const theme = useTheme();
	return (
		<View
			className="flex-1 items-center justify-center"
			style={{ padding: 24, backgroundColor: theme.colors.background }}
		>
			<Text
				variant="bodyLarge"
				style={{ color: theme.colors.onSurfaceVariant, textAlign: "center" }}
			>
				{label}
			</Text>
		</View>
	);
}
