import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, View } from "react-native";
import {
	Button,
	Card,
	Dialog,
	Portal,
	Text,
	useTheme,
} from "react-native-paper";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { deleteAllUserData } from "@/utils/delete-account";
import { clearLocalUserData } from "@/utils/session-storage";

/** How the user proves the session is theirs before the account is wiped. */
type Confirmation = "password" | "google" | "typed";

/**
 * Deletes the account and everything under it. Lives on the privacy policy,
 * next to the paragraph that promises it — the app has no settings screen, and
 * the promise needs a button behind it.
 */
export function DeleteAccountCard() {
	const { t } = useTranslation();
	const theme = useTheme();
	const online = useOnlineStatus();
	const {
		user,
		deleteAccount,
		reauthenticateWithPassword,
		reauthenticateWithGoogle,
	} = useAuth();

	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [typed, setTyped] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!user) return null;

	const providers = user.providerData.map((p) => p.providerId);
	const confirmation: Confirmation = providers.includes("password")
		? "password"
		: providers.includes("google.com") && Platform.OS === "web"
			? "google"
			: "typed";

	const confirmWord = t("screen.deleteAccount.confirmWord");
	const canConfirm =
		confirmation === "password"
			? password.length > 0
			: confirmation === "google" || typed.trim() === confirmWord;

	const close = () => {
		setOpen(false);
		setPassword("");
		setTyped("");
		setError(null);
	};

	const handleDelete = async () => {
		if (!online) {
			setError(t("screen.deleteAccount.error.offline"));
			return;
		}

		setBusy(true);
		setError(null);
		try {
			// Firebase rejects deletion on a stale session, so prove who this is
			// first — before anything is destroyed and there is no way back.
			if (confirmation === "password") {
				await reauthenticateWithPassword(password);
			} else if (confirmation === "google") {
				await reauthenticateWithGoogle();
			}

			// Firestore before auth: the security rules only let the signed-in user
			// touch their own documents, so once the auth user is gone the data
			// could never be reached again.
			await deleteAllUserData(user.uid);
			await clearLocalUserData(user.uid);
			await deleteAccount();
			// The auth listener sees the signed-out state and routes to login.
		} catch (e) {
			if (e instanceof FirebaseError) {
				if (
					e.code === "auth/wrong-password" ||
					e.code === "auth/invalid-credential"
				) {
					setError(t("screen.deleteAccount.error.wrongPassword"));
				} else if (e.code === "auth/requires-recent-login") {
					setError(t("screen.deleteAccount.error.reauth"));
				} else {
					setError(t("screen.deleteAccount.error.server"));
				}
			} else {
				setError(t("screen.deleteAccount.error.server"));
			}
			setBusy(false);
			return;
		}
		setBusy(false);
	};

	return (
		<Card mode="outlined" style={{ borderColor: theme.colors.error }}>
			<Card.Content>
				<View className="gap-3">
					<Text variant="bodyMedium">
						{t("screen.deleteAccount.dialogBody")}
					</Text>
					<Button
						mode="outlined"
						icon="delete-forever"
						textColor={theme.colors.error}
						onPress={() => setOpen(true)}
					>
						{t("screen.deleteAccount.button")}
					</Button>
				</View>
			</Card.Content>

			<Portal>
				<Dialog visible={open} onDismiss={busy ? () => {} : close}>
					<Dialog.Title>{t("screen.deleteAccount.dialogTitle")}</Dialog.Title>
					<Dialog.Content>
						<View className="gap-2">
							<Text variant="bodyMedium">
								{t("screen.deleteAccount.dialogBody")}
							</Text>

							{confirmation === "password" && (
								<>
									<Text variant="bodyMedium">
										{t("screen.deleteAccount.passwordPrompt")}
									</Text>
									<FormTextField
										label={t("screen.deleteAccount.passwordLabel")}
										value={password}
										onChangeText={(text) => {
											setPassword(text);
											setError(null);
										}}
										secureTextEntry
										autoComplete="current-password"
										disabled={busy}
									/>
								</>
							)}

							{confirmation === "google" && (
								<Text variant="bodyMedium">
									{t("screen.deleteAccount.googlePrompt")}
								</Text>
							)}

							{confirmation === "typed" && (
								<>
									<Text variant="bodyMedium">
										{t("screen.deleteAccount.confirmPrompt")}
									</Text>
									<FormTextField
										label={t("screen.deleteAccount.confirmLabel")}
										value={typed}
										onChangeText={(text) => {
											setTyped(text);
											setError(null);
										}}
										autoCapitalize="characters"
										autoCorrect={false}
										disabled={busy}
									/>
								</>
							)}

							{busy && (
								<Text variant="bodySmall">
									{t("screen.deleteAccount.deleting")}
								</Text>
							)}

							{error && (
								<Text variant="bodySmall" style={{ color: theme.colors.error }}>
									{error}
								</Text>
							)}
						</View>
					</Dialog.Content>
					<Dialog.Actions>
						<Button onPress={close} disabled={busy}>
							{t("screen.deleteAccount.cancel")}
						</Button>
						<Button
							onPress={handleDelete}
							loading={busy}
							disabled={busy || !canConfirm}
							textColor={theme.colors.error}
						>
							{t("screen.deleteAccount.confirm")}
						</Button>
					</Dialog.Actions>
				</Dialog>
			</Portal>
		</Card>
	);
}
