import { type Href, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Linking, View } from "react-native";
import { Appbar, Text, useTheme } from "react-native-paper";
import { ScreenContent } from "@/components/ui/ScreenContent";
import { useAuth } from "@/contexts/AuthContext";
import { useUpNavigation } from "@/hooks/use-up-navigation";

/** One block of a legal document, as stored in the translation file. */
export interface LegalSection {
	heading: string;
	/** Paragraphs above the bullet list. */
	paragraphs?: string[];
	bullets?: string[];
	/** Paragraphs below the bullet list. */
	paragraphsAfter?: string[];
}

interface LegalDocumentProps {
	/** i18n namespace holding `title`, `lastUpdated` and `sections`. */
	documentKey: "screen.privacy" | "screen.terms";
	/** Rendered after the last section — the delete-account block on privacy. */
	footer?: ReactNode;
}

/** Emails and bare URLs, so they can be turned into tappable links. */
const LINK_PATTERN =
	/(https?:\/\/[^\s.,)]+(?:[.,)][^\s.,)]+)*|[\w.+-]+@[\w-]+\.[\w.-]+)/g;

/** Strips a sentence-ending period that the pattern swept up with the link. */
function trimTrailingPunctuation(link: string): [string, string] {
	const match = link.match(/[.,)]+$/);
	if (!match) return [link, ""];
	return [link.slice(0, -match[0].length), match[0]];
}

function hrefFor(link: string): string {
	return link.includes("@") ? `mailto:${link}` : link;
}

/** Body text with any email address or URL rendered as an openable link. */
function LinkedText({ children }: { children: string }) {
	const theme = useTheme();
	const parts = children.split(LINK_PATTERN);

	return (
		<Text variant="bodyMedium">
			{parts.map((part, index) => {
				// `split` with one capture group alternates literal, match, literal…
				if (index % 2 === 0) return part;
				const [link, trailing] = trimTrailingPunctuation(part);
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: split output is positional
					<Text key={index}>
						<Text
							style={{
								color: theme.colors.primary,
								textDecorationLine: "underline",
							}}
							accessibilityRole="link"
							onPress={() => Linking.openURL(hrefFor(link))}
						>
							{link}
						</Text>
						{trailing}
					</Text>
				);
			})}
		</Text>
	);
}

/**
 * Renders the privacy policy and terms from the translation file, so the copy
 * lives with every other user-facing string instead of being baked into JSX.
 */
export function LegalDocument({ documentKey, footer }: LegalDocumentProps) {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user } = useAuth();
	const router = useRouter();
	// Legal pages are reachable from the login screen too, so a signed-out
	// visitor with no history must land back on login, not inside the app.
	const fallback: Href = user ? "/(app)/(tabs)/overview" : "/(auth)/login";
	const goBack = useUpNavigation(fallback);

	const sections = t(`${documentKey}.sections` as Parameters<typeof t>[0], {
		returnObjects: true,
	}) as unknown as LegalSection[];

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.elevation.level2 }}>
				<Appbar.BackAction
					onPress={goBack}
					accessibilityLabel={t("screen.legal.back")}
				/>
				<Appbar.Content
					title={t(`${documentKey}.title` as Parameters<typeof t>[0])}
				/>
			</Appbar.Header>

			<ScreenContent gap={6} paddingBottom={48} style={{ flex: 1 }}>
				<Text
					variant="bodySmall"
					style={{ color: theme.colors.onSurfaceVariant }}
				>
					{t("screen.legal.lastUpdated", {
						date: t(`${documentKey}.lastUpdated` as Parameters<typeof t>[0]),
					})}
				</Text>

				{sections.map((section) => (
					<View key={section.heading} className="gap-2">
						<Text variant="titleMedium">{section.heading}</Text>
						{section.paragraphs?.map((paragraph) => (
							<LinkedText key={paragraph}>{paragraph}</LinkedText>
						))}
						{section.bullets?.map((bullet) => (
							<View key={bullet} className="flex-row gap-2 pl-1">
								<Text variant="bodyMedium">•</Text>
								<View className="flex-1">
									<LinkedText>{bullet}</LinkedText>
								</View>
							</View>
						))}
						{section.paragraphsAfter?.map((paragraph) => (
							<LinkedText key={paragraph}>{paragraph}</LinkedText>
						))}
					</View>
				))}

				{footer}

				{/* The two documents reference each other, so each links to the other. */}
				<Text
					variant="bodySmall"
					style={{
						color: theme.colors.onSurfaceVariant,
						textDecorationLine: "underline",
						textAlign: "center",
					}}
					accessibilityRole="link"
					onPress={() =>
						router.push(
							documentKey === "screen.privacy"
								? "/(legal)/terms"
								: "/(legal)/privacy",
						)
					}
				>
					{t(
						documentKey === "screen.privacy"
							? "screen.legal.terms"
							: "screen.legal.privacy",
					)}
				</Text>
			</ScreenContent>
		</View>
	);
}
