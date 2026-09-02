import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import {
	Button,
	Checkbox,
	Divider,
	IconButton,
	Text,
	useTheme,
} from "react-native-paper";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { FormScaffold } from "@/components/ui/FormScaffold";
import { FormTextField } from "@/components/ui/FormTextField";
import {
	useSessionPresetActions,
	useSessionPresets,
} from "@/hooks/use-session-presets";
import { useUpNavigation } from "@/hooks/use-up-navigation";
import {
	PRESET_LINE_KEYS,
	PRESET_LINE_LIMITS,
	type PresetLineKey,
	type PresetLines,
	presetTotalMinutes,
	SCRATCH_PRESET_ID,
} from "@/models/session-preset";

/**
 * Six checkbox + slider rows in canonical order with a derived total. Zero is
 * not typeable: unchecking is how a category is switched off, and the slider's
 * minimum *is* the floor, so slivers are impossible by construction.
 *
 * Drives three modes — editing a saved preset, creating one, and the unsaved
 * Custom session, which starts straight from here and remembers its values in
 * the scratch doc.
 */
export default function PresetEditorScreen() {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const goBack = useUpNavigation("/(app)/(tabs)/overview");
	const params = useLocalSearchParams<{ presetId?: string }>();
	const presetId = params.presetId ?? null;
	const isCustom = presetId === SCRATCH_PRESET_ID;
	const isNew = presetId == null;

	const { presets, scratch } = useSessionPresets();
	const { addPreset, updatePreset, saveScratchPreset } =
		useSessionPresetActions();

	const source = useMemo(() => {
		if (isCustom) return scratch;
		if (isNew) return null;
		return presets.find((p) => p.id === presetId) ?? null;
	}, [isCustom, isNew, scratch, presets, presetId]);

	const [name, setName] = useState("");
	const [lines, setLines] = useState<PresetLines>({});
	const [dirty, setDirty] = useState(false);
	const [nameError, setNameError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	// Tap pins the explanation open; hover (web) reveals it while pointing.
	// A pinned row closes on click even under the pointer, and hover stays
	// dismissed until the pointer actually leaves, so boundary jitter cannot
	// flick the panel back open.
	const [pinnedInfo, setPinnedInfo] = useState<PresetLineKey | null>(null);
	const [hoveredInfo, setHoveredInfo] = useState<PresetLineKey | null>(null);
	const [hoverDismissed, setHoverDismissed] = useState(false);

	// Fill the form as soon as the document shows up, and stop once the user has
	// touched anything. A one-shot "hydrate when loaded" prefill would race the
	// route params and the auth user, both of which arrive after the first
	// render on a direct page load — and would leave the form blank when it lost.
	useEffect(() => {
		if (dirty || !source) return;
		setName(isCustom ? "" : source.name);
		setLines(source.lines);
	}, [dirty, source, isCustom]);

	const total = presetTotalMinutes(lines);
	const enabledCount = PRESET_LINE_KEYS.filter(
		(key) => lines[key] != null,
	).length;

	const toggleLine = (key: PresetLineKey) => {
		setDirty(true);
		setLines((prev) => ({
			...prev,
			[key]: prev[key] == null ? PRESET_LINE_LIMITS[key].floor : null,
		}));
	};

	const toggleInfo = (key: PresetLineKey) => {
		if (pinnedInfo === key) {
			setPinnedInfo(null);
			setHoverDismissed(true);
		} else {
			setPinnedInfo(key);
			setHoverDismissed(false);
		}
	};

	const hoverInfo = (key: PresetLineKey, hovering: boolean) => {
		if (hovering) {
			setHoveredInfo(key);
		} else {
			setHoveredInfo((prev) => (prev === key ? null : prev));
			setHoverDismissed(false);
		}
	};

	const setLineMinutes = (key: PresetLineKey, value: number) => {
		setDirty(true);
		setLines((prev) => ({ ...prev, [key]: Math.round(value) }));
	};

	const requireName = (): boolean => {
		if (name.trim()) {
			setNameError(null);
			return true;
		}
		setNameError(t("screen.session.editor.nameRequired"));
		return false;
	};

	const guarded = async (fn: () => Promise<void>) => {
		setSaving(true);
		try {
			await fn();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	};

	/** New presets land at the end of the list. */
	const nextOrder = presets.reduce((max, p) => Math.max(max, p.order), -1) + 1;

	const handleSave = () =>
		guarded(async () => {
			if (!requireName()) return;
			if (isNew || !presetId) {
				await addPreset(name.trim(), lines, nextOrder);
			} else {
				await updatePreset(presetId, { name: name.trim(), lines });
			}
			goBack();
		});

	const handleSaveAsNew = () =>
		guarded(async () => {
			if (!requireName()) return;
			await addPreset(name.trim(), lines, nextOrder);
			goBack();
		});

	// Starting Custom writes the values back to the scratch doc, so the Custom
	// row on Overview always shows what was last run.
	const handleStartCustom = () =>
		guarded(async () => {
			await saveScratchPreset(lines);
			router.push(`/session/setup?presetId=${SCRATCH_PRESET_ID}` as const);
		});

	const title = isCustom
		? t("screen.session.editor.titleCustom")
		: isNew
			? t("screen.session.editor.titleNew")
			: t("screen.session.editor.titleEdit");

	return (
		<FormScaffold
			title={title}
			onBack={goBack}
			error={error}
			onDismissError={() => setError(null)}
		>
			<View className="gap-2">
				<FormTextField
					label={t("screen.session.editor.nameLabel")}
					value={name}
					onChangeText={setName}
					onBlur={() => name.trim() && setNameError(null)}
					error={nameError}
				/>

				{PRESET_LINE_KEYS.map((key) => (
					<LineRow
						key={key}
						lineKey={key}
						minutes={lines[key] ?? null}
						infoOpen={
							pinnedInfo === key || (hoveredInfo === key && !hoverDismissed)
						}
						onToggleInfo={() => toggleInfo(key)}
						onHoverInfo={(hovering) => hoverInfo(key, hovering)}
						onToggle={() => toggleLine(key)}
						onChange={(v) => setLineMinutes(key, v)}
					/>
				))}

				<Divider />

				<View
					className="flex-row items-center justify-between"
					style={{ paddingVertical: 12 }}
				>
					<Text variant="bodyLarge" style={{ fontWeight: "600" }}>
						{t("screen.session.editor.total")}
					</Text>
					<Text variant="bodyLarge" style={{ fontWeight: "600" }}>
						{enabledCount === 0
							? t("screen.session.editor.off")
							: t("screen.session.editor.minutes", { minutes: total })}
					</Text>
				</View>

				{enabledCount === 0 && (
					<Text
						variant="bodySmall"
						style={{ color: theme.colors.onSurfaceVariant }}
					>
						{t("screen.session.editor.empty")}
					</Text>
				)}

				<View className="flex-row gap-2" style={{ marginTop: 8 }}>
					{isCustom ? (
						<>
							<Button
								mode="contained"
								onPress={handleStartCustom}
								loading={saving}
								disabled={saving || enabledCount === 0}
								className="flex-1"
							>
								{t("screen.session.editor.start")}
							</Button>
							<Button
								mode="outlined"
								onPress={handleSaveAsNew}
								disabled={saving || enabledCount === 0}
								className="flex-1"
							>
								{t("screen.session.editor.saveAsPreset")}
							</Button>
						</>
					) : (
						<>
							<Button
								mode="contained"
								onPress={handleSave}
								loading={saving}
								disabled={saving || enabledCount === 0}
								className="flex-1"
							>
								{t("screen.session.editor.save")}
							</Button>
							{!isNew && (
								<Button
									mode="outlined"
									onPress={handleSaveAsNew}
									disabled={saving || enabledCount === 0}
									className="flex-1"
								>
									{t("screen.session.editor.saveAsNew")}
								</Button>
							)}
						</>
					)}
				</View>
			</View>
		</FormScaffold>
	);
}

/** Checkbox column width — the ⓘ text lines up under the label, not the box. */
const LABEL_INDENT = 40;

/**
 * One line: a checkbox that switches the category off entirely, a slider whose
 * minimum is the category's floor, and an ⓘ that expands into what the category
 * actually means — the vocabulary the flat model now asks the student to use.
 */
function LineRow({
	lineKey,
	minutes,
	infoOpen,
	onToggle,
	onToggleInfo,
	onHoverInfo,
	onChange,
}: {
	lineKey: PresetLineKey;
	minutes: number | null;
	infoOpen: boolean;
	onToggle: () => void;
	onToggleInfo: () => void;
	onHoverInfo: (hovering: boolean) => void;
	onChange: (value: number) => void;
}) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { floor, max, step } = PRESET_LINE_LIMITS[lineKey];
	const enabled = minutes != null;
	const label = t(`screen.session.editor.line.${lineKey}` as const);

	return (
		<View style={{ paddingBottom: 4 }}>
			<View className="flex-row items-center">
				{/* Wrapped rather than flexed directly: Checkbox.Item does not
				    stretch its own touchable, so the minutes column would drift. */}
				<View className="flex-1">
					<Checkbox.Item
						mode="android"
						position="leading"
						status={enabled ? "checked" : "unchecked"}
						onPress={onToggle}
						label={label}
						accessibilityLabel={t("screen.session.editor.toggleA11y", {
							line: label,
						})}
						style={{ paddingHorizontal: 0, paddingVertical: 0 }}
						labelStyle={{ textAlign: "left" }}
					/>
				</View>
				<Text
					variant="bodyMedium"
					style={{
						minWidth: 56,
						textAlign: "right",
						color: enabled
							? theme.colors.onSurface
							: theme.colors.onSurfaceVariant,
					}}
				>
					{enabled
						? t("screen.session.editor.minutes", { minutes })
						: t("screen.session.editor.off")}
				</Text>
				<View
					onPointerEnter={() => onHoverInfo(true)}
					onPointerLeave={() => onHoverInfo(false)}
				>
					<IconButton
						icon="information-outline"
						size={20}
						onPress={onToggleInfo}
						accessibilityLabel={t("screen.session.editor.infoA11y", {
							line: label,
						})}
					/>
				</View>
			</View>
			<Slider
				minimumValue={floor}
				maximumValue={max}
				step={step}
				value={minutes ?? floor}
				disabled={!enabled}
				onValueChange={onChange}
				minimumTrackTintColor={
					enabled ? theme.colors.primary : theme.colors.surfaceVariant
				}
				maximumTrackTintColor={theme.colors.surfaceVariant}
				thumbTintColor={
					enabled ? theme.colors.primary : theme.colors.surfaceVariant
				}
				accessibilityLabel={t("screen.session.editor.lineA11y", {
					line: label,
					minutes: minutes ?? floor,
				})}
			/>
			{infoOpen && (
				// FadeInDown/FadeOutDown default to ReduceMotion.System, so the
				// OS reduce-motion setting turns them off.
				<Animated.View
					entering={FadeInDown.duration(150)}
					exiting={FadeOutDown.duration(150)}
				>
					<Text
						variant="bodySmall"
						// Indented to line up under the row label, not the checkbox.
						style={{
							color: theme.colors.onSurfaceVariant,
							paddingLeft: LABEL_INDENT,
							paddingTop: 4,
						}}
					>
						{t(`screen.session.editor.info.${lineKey}` as const)}
					</Text>
				</Animated.View>
			)}
		</View>
	);
}
