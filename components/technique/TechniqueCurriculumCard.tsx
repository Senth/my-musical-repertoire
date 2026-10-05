import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button, Card, Icon, Menu, Text, useTheme } from "react-native-paper";
import { StartTechniqueSheet } from "@/components/technique/StartTechniqueSheet";
import { TechniqueStateChip } from "@/components/technique/TechniqueStateChip";
import {
	accentBorderStyle,
	CARD_TITLE_STYLE,
} from "@/components/ui/card-style";
import {
	useAdvanceTechnique,
	useSnoozeTechniqueNudge,
} from "@/hooks/use-techniques";
import type { TechniqueItem } from "@/models/technique";
import { icon, space } from "@/theme/tokens";
import { techniqueStateVisual } from "@/utils/state-colors";
import {
	DEFAULT_SNOOZE_DAYS,
	notStartedQueue,
	SNOOZE_DAYS,
	type TechniqueNudge,
} from "@/utils/technique-curriculum";

const SNOOZE_LABELS = {
	7: "technique.curriculum.snooze.week",
	14: "technique.curriculum.snooze.twoWeeks",
	30: "technique.curriculum.snooze.month",
} as const;

interface TechniqueCurriculumCardProps {
	tech: TechniqueItem & { id: string };
	techniques: TechniqueItem[];
	nudge: TechniqueNudge;
	/** The summary names the technique; the detail screen's app bar already does. */
	showTitle?: boolean;
	onError: (message: string) => void;
}

export function TechniqueCurriculumCard({
	tech,
	techniques,
	nudge,
	showTitle = false,
	onError,
}: TechniqueCurriculumCardProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const router = useRouter();
	const { advance } = useAdvanceTechnique();
	const { snooze } = useSnoozeTechniqueNudge();
	const [menuVisible, setMenuVisible] = useState(false);
	const [sheetVisible, setSheetVisible] = useState(false);

	const run = async (write: () => Promise<void>) => {
		try {
			await write();
			return true;
		} catch {
			onError(t("error.firebase"));
			return false;
		}
	};

	const start = (toId: string) => {
		setSheetVisible(false);
		return run(() => advance(tech.id, toId));
	};

	const addNew = async () => {
		setSheetVisible(false);
		if (await run(() => advance(tech.id, null))) {
			router.push("/technique/add");
		}
	};

	const snoozeFor = (days: number) => {
		setMenuVisible(false);
		return run(() => snooze(tech.id, days));
	};

	const reason = [
		nudge.bpm != null
			? t("technique.curriculum.reasonTempo", {
					bpm: nudge.bpm,
					days: nudge.cleanDays,
				})
			: t("technique.curriculum.reasonQuality", { days: nudge.cleanDays }),
		nudge.next
			? t("technique.curriculum.next", { title: nudge.next.title })
			: t("technique.curriculum.room"),
	].join(" ");

	return (
		<Card
			mode="elevated"
			style={accentBorderStyle(techniqueStateVisual("active", theme.dark))}
		>
			{showTitle && (
				<Card.Title title={tech.title} titleStyle={CARD_TITLE_STYLE} />
			)}
			<Card.Content style={{ gap: space.md }}>
				<View
					accessible
					accessibilityLabel={t("a11y.technique.curriculumMove", {
						title: tech.title,
					})}
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: space.sm,
					}}
				>
					<TechniqueStateChip state="active" />
					<Icon
						source="arrow-right"
						size={icon.md}
						color={theme.colors.onSurfaceVariant}
					/>
					<TechniqueStateChip state="maintenance" />
				</View>
				<Text
					variant="bodyMedium"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{reason}
				</Text>
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						alignItems: "center",
						gap: space.sm,
					}}
				>
					{nudge.next ? (
						<>
							<Button
								mode="contained-tonal"
								icon="play"
								style={{ maxWidth: "100%" }}
								onPress={() => nudge.next?.id && start(nudge.next.id)}
							>
								{t("technique.curriculum.start", { title: nudge.next.title })}
							</Button>
							<Button mode="text" onPress={() => setSheetVisible(true)}>
								{t("technique.curriculum.chooseAnother")}
							</Button>
						</>
					) : (
						<Button mode="contained-tonal" onPress={addNew}>
							{t("technique.curriculum.add")}
						</Button>
					)}
					<Menu
						visible={menuVisible}
						onDismiss={() => setMenuVisible(false)}
						anchor={
							<Button
								mode="text"
								icon="menu-down"
								contentStyle={{ flexDirection: "row-reverse" }}
								onPress={() => setMenuVisible(true)}
							>
								{t("technique.curriculum.notYet")}
							</Button>
						}
					>
						{SNOOZE_DAYS.map((days) => (
							<Menu.Item
								key={days}
								title={t(SNOOZE_LABELS[days])}
								style={
									days === DEFAULT_SNOOZE_DAYS
										? { backgroundColor: theme.colors.secondaryContainer }
										: undefined
								}
								onPress={() => snoozeFor(days)}
							/>
						))}
					</Menu>
				</View>
			</Card.Content>
			<StartTechniqueSheet
				visible={sheetVisible}
				onDismiss={() => setSheetVisible(false)}
				fromTitle={tech.title}
				candidates={notStartedQueue(techniques)}
				onPick={start}
				onCreate={addNew}
			/>
		</Card>
	);
}
