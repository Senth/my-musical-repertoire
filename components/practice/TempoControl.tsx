import Slider from "@react-native-community/slider";
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Animated, Pressable, View } from "react-native";
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
import { border, space } from "@/theme/tokens";
import {
	readMetronomeAccent,
	writeMetronomeAccent,
} from "@/utils/session-storage";
import { addTap, bpmFromTaps } from "@/utils/tap-tempo";
import {
	type PlacedTempoMark,
	placeTempoMarkers,
	type TempoMark,
} from "@/utils/tempo-markers";
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
	/**
	 * Called with the text actually committed on blur — the clamped value when
	 * an out-of-range entry was pulled into range — so validation never reads
	 * the pre-clamp snapshot.
	 */
	onBlur: (committed: string) => void;
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
/** Strip above the slider that holds the markers; collapses when there is
 * nothing to mark, so a block with no markers sits tight under its heading. */
const MARKER_STRIP_HEIGHT = 30;
/** Seated 8px into the slider's own top padding, so the chevron tip touches
 * the track's top edge the way round 8 draws it. */
const MARKER_ARROW_BOTTOM = -8;
const MARKER_ARROW_SIZE = 15;
/** Three more pixels of air between a label and the arrow beneath it. */
const MARKER_LABEL_AIR = 3;
const MARKER_LABEL_BOTTOM =
	MARKER_ARROW_BOTTOM + MARKER_ARROW_SIZE + MARKER_LABEL_AIR;
/** Half the chevron's visible width — the box a lifted arrow occupies in the
 * label's band. */
const MARKER_ARROW_HALF = 6;
/** How far the covered arrow rises clear of the thumb standing on it. */
const MARKER_ARROW_LIFT = 10;
/** Knob overlap plus 2px: a marker this close to the thumb is under it. */
const MARKER_LIFT_OVERLAP = 15;
const LIFT_MS = 150;

function clamp(n: number): number {
	return Math.max(BPM_MIN, Math.min(BPM_MAX, n));
}

/** `prefers-reduced-motion`, via the platform's accessibility info. */
function useReducedMotion(): boolean {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		let active = true;
		AccessibilityInfo.isReduceMotionEnabled().then((value) => {
			if (active) setReduced(value);
		});
		const sub = AccessibilityInfo.addEventListener(
			"reduceMotionChanged",
			setReduced,
		);
		return () => {
			active = false;
			sub.remove();
		};
	}, []);
	return reduced;
}

function MarkerArrow({
	percent,
	color,
	lifted,
	reducedMotion,
}: {
	percent: number;
	color: string;
	lifted: boolean;
	reducedMotion: boolean;
}) {
	const target = lifted ? -MARKER_ARROW_LIFT : 0;
	const y = useRef(new Animated.Value(target)).current;
	const at = useRef(target);
	const entered = useRef(false);
	useEffect(() => {
		if (target === at.current) return;
		at.current = target;
		// The first geometry-known transition is arrival, not motion — the
		// pre-layout render always reports unlifted, so nothing animates on entry.
		if (!entered.current || reducedMotion) {
			entered.current = true;
			y.setValue(target);
			return;
		}
		Animated.timing(y, {
			toValue: target,
			duration: LIFT_MS,
			useNativeDriver: true,
		}).start();
	}, [target, reducedMotion, y]);
	return (
		<View
			style={{
				position: "absolute",
				bottom: MARKER_ARROW_BOTTOM,
				left: `${percent}%`,
				transform: [{ translateX: "-50%" }],
			}}
		>
			<Animated.View style={{ transform: [{ translateY: y }] }}>
				<Icon source="menu-down" size={MARKER_ARROW_SIZE} color={color} />
			</Animated.View>
		</View>
	);
}

function TempoMarkerLabel({
	text,
	color,
	box,
	reducedMotion,
	onMeasure,
}: {
	text: string;
	color: string;
	box: PlacedTempoMark | undefined;
	reducedMotion: boolean;
	onMeasure: (width: number) => void;
}) {
	const x = useRef(new Animated.Value(0)).current;
	const at = useRef<number | null>(null);
	useEffect(() => {
		if (!box || at.current === box.left) return;
		// First paint with a placed box is arrival, not motion — nothing
		// animates on entry.
		const entry = at.current === null;
		at.current = box.left;
		if (entry || reducedMotion) {
			x.setValue(box.left);
			return;
		}
		Animated.timing(x, {
			toValue: box.left,
			duration: LIFT_MS,
			useNativeDriver: true,
		}).start();
	}, [box, reducedMotion, x]);
	return (
		<Animated.View
			style={{
				position: "absolute",
				bottom: MARKER_LABEL_BOTTOM,
				// Position rides the transform so a sideways move animates;
				// the label keeps one height throughout.
				transform: [{ translateX: x }],
				// Held invisible until measured: placement needs the label's width.
				...(box ? null : { opacity: 0 }),
			}}
		>
			<Text
				variant="labelSmall"
				onLayout={(e) => onMeasure(e.nativeEvent.layout.width)}
				style={{ color }}
			>
				{text}
			</Text>
		</Animated.View>
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
	// The working BPM: a valid draft, or the slider minimum the untouched thumb
	// sits on. Steppers and the metronome work from it, so the one gesture that
	// fixes a 20 can be made — but mid-edit the typed text governs, so a
	// half-typed "2" is not a 20.
	const effective = isValid ? clamp(parsed) : editing ? NaN : range.min;

	function adjust(delta: number) {
		if (!Number.isFinite(effective)) return;
		onChangeText(clamp(effective + delta).toString());
	}

	function tap() {
		tapsRef.current = addTap(tapsRef.current, Date.now());
		const bpm = bpmFromTaps(tapsRef.current);
		if (bpm !== null) onChangeText(clamp(bpm).toString());
	}

	// Typing commits on blur: an out-of-range number is clamped into range,
	// and validation runs on the value actually kept.
	const handleBlur = () => {
		setEditing(false);
		if (isValid && (parsed < BPM_MIN || parsed > BPM_MAX)) {
			const clamped = clamp(parsed).toString();
			onChangeText(clamped);
			onBlur(clamped);
			return;
		}
		onBlur(value);
	};

	const percent = (bpm: number) =>
		((bpm - range.min) / (range.max - range.min)) * 100;
	const lastPos = last != null ? percent(clamp(last)) : null;
	const targetPos = target != null ? percent(clamp(target)) : null;
	const hasMarkers = lastPos != null || targetPos != null;

	const accentTint = theme.colors.onSurfaceVariant;
	const beatsPerBar =
		accentOn && accent?.signature ? accent.signature.beats : null;

	const [trackWidth, setTrackWidth] = useState(0);
	const [labelWidths, setLabelWidths] = useState<{
		last: number | null;
		target: number | null;
	}>({ last: null, target: null });
	const reducedMotion = useReducedMotion();
	const thumbX = (percent(sliderValue) / 100) * trackWidth;
	const lifted = (x: number) => Math.abs(x - thumbX) < MARKER_LIFT_OVERLAP;
	const lastX =
		lastPos != null && trackWidth > 0 ? (lastPos / 100) * trackWidth : null;
	const targetX =
		targetPos != null && trackWidth > 0 ? (targetPos / 100) * trackWidth : null;
	const marks: TempoMark[] = [];
	if (last != null && lastX != null && labelWidths.last) {
		marks.push({
			id: "last",
			value: clamp(last),
			x: lastX,
			width: labelWidths.last,
			lifted: lifted(lastX),
		});
	}
	if (target != null && targetX != null && labelWidths.target) {
		marks.push({
			id: "target",
			value: clamp(target),
			x: targetX,
			width: labelWidths.target,
			lifted: lifted(targetX),
		});
	}
	const placedMarks =
		marks.length > 0
			? placeTempoMarkers({
					trackWidth,
					gap: space.sm,
					sideGap: space.sm,
					arrowHalf: MARKER_ARROW_HALF,
					marks,
				})
			: [];
	const boxFor = (id: TempoMark["id"]) => placedMarks.find((p) => p.id === id);

	return (
		<View style={{ gap: 12 }}>
			<Text variant="labelLarge">{t("common.tempo.heading")}</Text>

			{/* r8's `.sld`: markers and track in one block, lifted -10px toward the
			    heading, with the chevron tips touching the track's top edge. */}
			<View style={{ marginTop: -10 }}>
				<View
					pointerEvents="none"
					style={{ height: hasMarkers ? MARKER_STRIP_HEIGHT : 0 }}
					onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
				>
					{lastPos != null && (
						<TempoMarkerLabel
							text={t("common.tempo.last", { bpm: last })}
							color={accentTint}
							box={boxFor("last")}
							reducedMotion={reducedMotion}
							onMeasure={(width) =>
								setLabelWidths((w) => ({ ...w, last: width }))
							}
						/>
					)}
					{targetPos != null && (
						<TempoMarkerLabel
							text={t("common.tempo.target", { bpm: target })}
							color={accentTint}
							box={boxFor("target")}
							reducedMotion={reducedMotion}
							onMeasure={(width) =>
								setLabelWidths((w) => ({ ...w, target: width }))
							}
						/>
					)}
					{lastPos != null && (
						<MarkerArrow
							percent={lastPos}
							color={accentTint}
							lifted={lastX != null && lifted(lastX)}
							reducedMotion={reducedMotion}
						/>
					)}
					{targetPos != null && (
						<MarkerArrow
							percent={targetPos}
							color={accentTint}
							lifted={targetX != null && lifted(targetX)}
							reducedMotion={reducedMotion}
						/>
					)}
				</View>
				<Slider
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
			</View>

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
					disabled={!Number.isFinite(effective)}
					accessibilityLabel={t("common.bpm.decreaseFive")}
				/>
				<IconButton
					icon="chevron-left"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(-1)}
					disabled={!Number.isFinite(effective)}
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
							{/* An untouched tempo displays the slider's minimum, where
							    the thumb already sits. Display only: the draft stays
							    empty and an untouched tempo still saves as no tempo at
							    all — but a stepper press is deliberate and starts from
							    the displayed value. */}
							<Text
								variant="displaySmall"
								style={{
									borderBottomWidth: border.hairline,
									borderStyle: "dashed",
									borderBottomColor: theme.colors.outline,
								}}
							>
								{Number.isFinite(effective) ? effective : range.min}
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
					disabled={!Number.isFinite(effective)}
					accessibilityLabel={t("common.bpm.increaseOne")}
				/>
				<IconButton
					icon="chevron-double-right"
					mode="outlined"
					size={20}
					iconColor={theme.colors.primary}
					onPress={() => adjust(5)}
					disabled={!Number.isFinite(effective)}
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
						bpm={Number.isFinite(effective) ? effective.toString() : value}
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
