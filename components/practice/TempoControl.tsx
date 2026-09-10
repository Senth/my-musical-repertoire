import Slider from "@react-native-community/slider";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";
import {
	Button,
	HelperText,
	Icon,
	IconButton,
	Text,
	TextInput,
	useTheme,
} from "react-native-paper";
import { useAuth } from "@/contexts/AuthContext";
import {
	readMetronomeAccent,
	writeMetronomeAccent,
} from "@/utils/session-storage";
import { addTap, bpmFromTaps } from "@/utils/tap-tempo";
import { tempoSliderRange } from "@/utils/tempo-slider";
import type {
	TimeSignature,
	TimeSignatureWritePlan,
} from "@/utils/time-signature";
import { AccentChip } from "./AccentChip";
import { MetronomeButton } from "./MetronomeButton";

export interface AccentControl {
	signature: TimeSignature | null;
	planFor: (next: TimeSignature) => TimeSignatureWritePlan;
	onChange: (next: TimeSignature) => void;
	onClear: () => void;
}

interface TempoControlProps {
	value: string;
	onChangeText: (text: string) => void;
	error: string | null;
	onBlur: () => void;
	stopRef?: MutableRefObject<(() => void) | null>;
	accent?: AccentControl;
	/** The passage's target tempo, drawn as a marker when present. */
	target?: number | null;
	/** The tempo last achieved, drawn as a marker when present. */
	last?: number | null;
	/** Full 20-240 track — sight-reading has no target to scale against. */
	fullRange?: boolean;
}

const BPM_MIN = 20;
const BPM_MAX = 240;
/** Two markers closer than this share the midpoint instead of overlapping. */
const MARKER_GAP_PCT = 14;

function clamp(n: number): number {
	return Math.max(BPM_MIN, Math.min(BPM_MAX, n));
}

type MarkerShift = "center" | "left" | "right";

function TempoMarker({
	label,
	percent,
	shift,
	color,
}: {
	label: string;
	percent: number;
	shift: MarkerShift;
	color: string;
}) {
	return (
		<View
			pointerEvents="none"
			style={{
				position: "absolute",
				bottom: 0,
				left: `${Math.min(94, Math.max(6, percent))}%`,
				transform: [
					{
						translateX:
							shift === "center" ? "-50%" : shift === "left" ? "-100%" : "0%",
					},
				],
				alignItems:
					shift === "left"
						? "flex-end"
						: shift === "right"
							? "flex-start"
							: "center",
				paddingHorizontal: shift === "center" ? 0 : 4,
			}}
		>
			<Text variant="labelSmall" style={{ color }}>
				{label}
			</Text>
			<Icon source="menu-down" size={15} color={color} />
		</View>
	);
}

export function TempoControl({
	value,
	onChangeText,
	error,
	onBlur,
	stopRef,
	accent,
	target = null,
	last = null,
	fullRange = false,
}: TempoControlProps) {
	const { t } = useTranslation();
	const { user } = useAuth();
	const theme = useTheme();
	const parsed = Number.parseInt(value.trim(), 10);
	const isValid = !Number.isNaN(parsed);
	const [accentOn, setAccentOn] = useState(false);
	const [editing, setEditing] = useState(false);
	const tapsRef = useRef<number[]>([]);

	useEffect(() => {
		if (!user) return;
		let active = true;
		readMetronomeAccent(user.uid).then((saved) => {
			if (active) setAccentOn(saved);
		});
		return () => {
			active = false;
		};
	}, [user]);

	const toggleAccent = useCallback(() => {
		const next = !accentOn;
		setAccentOn(next);
		if (user) void writeMetronomeAccent(user.uid, next);
	}, [accentOn, user]);

	const range = tempoSliderRange({
		target,
		value: isValid ? parsed : null,
		fullRange,
	});
	const sliderValue = isValid ? clamp(parsed) : range.min;

	function adjust(delta: number) {
		if (!isValid) return;
		onChangeText(clamp(parsed + delta).toString());
	}

	function tap() {
		tapsRef.current = addTap(tapsRef.current, Date.now());
		const bpm = bpmFromTaps(tapsRef.current);
		if (bpm !== null) onChangeText(clamp(bpm).toString());
	}

	// Typing commits on blur: an out-of-range number is clamped into range
	// before the screens' validation runs, so the error never outlives the
	// value it was about.
	const handleBlur = () => {
		setEditing(false);
		if (isValid && (parsed < BPM_MIN || parsed > BPM_MAX)) {
			onChangeText(clamp(parsed).toString());
		}
		onBlur();
	};

	const percent = (bpm: number) =>
		((bpm - range.min) / (range.max - range.min)) * 100;
	const lastPos = last != null ? percent(clamp(last)) : null;
	const targetPos = target != null ? percent(clamp(target)) : null;
	const close =
		lastPos != null &&
		targetPos != null &&
		Math.abs(lastPos - targetPos) < MARKER_GAP_PCT;
	const mid =
		close && lastPos != null && targetPos != null
			? (lastPos + targetPos) / 2
			: null;

	const accentTint = theme.colors.onSurfaceVariant;
	const beatsPerBar =
		accentOn && accent?.signature ? accent.signature.beats : null;

	return (
		<View style={{ gap: 12 }}>
			<Text variant="labelLarge">{t("common.tempo.heading")}</Text>

			<View style={{ height: 30 }}>
				{lastPos != null && (
					<TempoMarker
						label={t("common.tempo.last", { bpm: last })}
						percent={close && mid != null ? mid : lastPos}
						shift={close ? "left" : "center"}
						color={accentTint}
					/>
				)}
				{targetPos != null && (
					<TempoMarker
						label={t("common.tempo.target", { bpm: target })}
						percent={close && mid != null ? mid : targetPos}
						shift={close ? "right" : "center"}
						color={accentTint}
					/>
				)}
			</View>
			<Slider
				style={{ marginTop: -10 }}
				minimumValue={range.min}
				maximumValue={range.max}
				step={1}
				value={sliderValue}
				onValueChange={(v) => onChangeText(Math.round(v).toString())}
				minimumTrackTintColor={theme.colors.primary}
				maximumTrackTintColor={theme.colors.outlineVariant}
				thumbTintColor={theme.colors.primary}
				accessibilityLabel={t("common.tempo.sliderA11y")}
			/>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 12,
				}}
			>
				<IconButton
					icon="chevron-double-left"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(-5)}
					disabled={!isValid}
					accessibilityLabel={t("common.bpm.decreaseFive")}
				/>
				<IconButton
					icon="chevron-left"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(-1)}
					disabled={!isValid}
					accessibilityLabel={t("common.bpm.decreaseOne")}
				/>
				{editing ? (
					<TextInput
						mode="flat"
						value={value}
						onChangeText={onChangeText}
						keyboardType="numeric"
						placeholder={t("common.bpm.placeholder")}
						autoFocus
						selectTextOnFocus
						onBlur={handleBlur}
						onSubmitEditing={handleBlur}
						style={{ width: 96, textAlign: "center" }}
						accessibilityLabel={t("common.tempo.editA11y")}
					/>
				) : (
					<Pressable
						onPress={() => setEditing(true)}
						accessibilityRole="button"
						accessibilityLabel={t("common.tempo.editA11y")}
					>
						<View
							style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
						>
							<Text
								variant="displaySmall"
								style={{
									borderBottomWidth: 1,
									borderStyle: "dashed",
									borderBottomColor: theme.colors.outline,
								}}
							>
								{isValid ? parsed : "—"}
							</Text>
							<Text
								variant="bodySmall"
								style={{ color: theme.colors.onSurfaceVariant }}
							>
								{t("common.tempo.unit")}
							</Text>
						</View>
					</Pressable>
				)}
				<IconButton
					icon="chevron-right"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(1)}
					disabled={!isValid}
					accessibilityLabel={t("common.bpm.increaseOne")}
				/>
				<IconButton
					icon="chevron-double-right"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(5)}
					disabled={!isValid}
					accessibilityLabel={t("common.bpm.increaseFive")}
				/>
			</View>

			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "center",
					gap: 8,
				}}
			>
				<Button
					mode="outlined"
					onPress={tap}
					contentStyle={{ paddingHorizontal: 6 }}
				>
					{t("common.bpm.tap")}
				</Button>
				{stopRef !== undefined && (
					<MetronomeButton
						bpm={value}
						beatsPerBar={beatsPerBar}
						disabled={!!error}
						stopRef={stopRef}
					/>
				)}
				{accent && (
					<AccentChip
						accentOn={accentOn}
						signature={accent.signature}
						onToggleAccent={toggleAccent}
						planFor={accent.planFor}
						onChange={accent.onChange}
						onClear={accent.onClear}
					/>
				)}
			</View>

			<HelperText type="error" visible={!!error}>
				{error ?? ""}
			</HelperText>
		</View>
	);
}
