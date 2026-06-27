import { useLocalSearchParams } from "expo-router";
import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import {
	Appbar,
	Button,
	Card,
	HelperText,
	Snackbar,
	useTheme,
} from "react-native-paper";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAuth } from "@/contexts/AuthContext";
import { useIsCompact } from "@/hooks/use-is-compact";

type Mode = "signIn" | "register";

export default function LoginScreen() {
	const { t } = useTranslation();
	const {
		signInWithEmail,
		registerWithEmail,
		getSignInMethodsForEmail,
		sendPasswordResetEmail,
	} = useAuth();
	const { passwordSet } = useLocalSearchParams<{ passwordSet?: string }>();
	const theme = useTheme();
	const isCompact = useIsCompact();

	const [mode, setMode] = useState<Mode>("signIn");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [emailError, setEmailError] = useState<string | null>(null);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [confirmPasswordError, setConfirmPasswordError] = useState<
		string | null
	>(null);
	const [googleAccountDetected, setGoogleAccountDetected] = useState(false);
	const [passwordResetSent, setPasswordResetSent] = useState(false);
	const [passwordResetLoading, setPasswordResetLoading] = useState(false);
	const [recoveryError, setRecoveryError] = useState<string | null>(null);

	const switchMode = () => {
		setMode((m) => (m === "signIn" ? "register" : "signIn"));
		setEmailError(null);
		setPasswordError(null);
		setConfirmPasswordError(null);
		setServerError(null);
		setGoogleAccountDetected(false);
		setPasswordResetSent(false);
		setRecoveryError(null);
	};

	const handleSetPassword = async () => {
		setPasswordResetLoading(true);
		setRecoveryError(null);
		try {
			await sendPasswordResetEmail(email.trim());
			setPasswordResetSent(true);
		} catch {
			setRecoveryError(t("screen.login.setPasswordError"));
		} finally {
			setPasswordResetLoading(false);
		}
	};

	const handleSubmit = async () => {
		setEmailError(null);
		setPasswordError(null);
		setConfirmPasswordError(null);
		setServerError(null);

		if (!email.trim()) {
			setEmailError(t("screen.login.error.email"));
			return;
		}

		if (mode === "register" && password !== confirmPassword) {
			setConfirmPasswordError(t("screen.login.error.passwordMismatch"));
			return;
		}

		setLoading(true);

		try {
			if (mode === "signIn") {
				await signInWithEmail(email.trim(), password);
			} else {
				await registerWithEmail(email.trim(), password);
			}
		} catch (e) {
			if (e instanceof FirebaseError) {
				const isGoogleCheckable =
					e.code === "auth/user-not-found" ||
					e.code === "auth/wrong-password" ||
					e.code === "auth/invalid-credential" ||
					e.code === "auth/email-already-in-use";

				if (isGoogleCheckable) {
					try {
						const methods = await getSignInMethodsForEmail(email.trim());
						if (
							methods.includes("google.com") &&
							!methods.includes("password")
						) {
							try {
								await sendPasswordResetEmail(email.trim());
								setPasswordResetSent(true);
							} catch {
								// auto-send failed; user can still click "Set Password" manually
							}
							setGoogleAccountDetected(true);
							return;
						}
					} catch {
						// fetchSignInMethodsForEmail unavailable — fall through to generic error
					}
				}

				switch (e.code) {
					case "auth/user-not-found":
						setEmailError(t("screen.login.error.userNotFound"));
						break;
					case "auth/user-disabled":
						setEmailError(t("screen.login.error.userDisabled"));
						break;
					case "auth/wrong-password":
					case "auth/invalid-credential":
						setPasswordError(t("screen.login.error.userNotFound"));
						break;
					case "auth/email-already-in-use":
						setEmailError(t("screen.login.error.emailInUse"));
						break;
					case "auth/weak-password":
						setPasswordError(t("screen.login.error.weakPassword"));
						break;
					default:
						setServerError(t("screen.login.error.server"));
				}
			} else {
				setServerError(t("screen.login.error.server"));
			}
		} finally {
			setLoading(false);
		}
	};

	const formContent = (
		<View className="gap-2">
			<FormTextField
				label={t("screen.login.emailLabel")}
				value={email}
				onChangeText={(text) => {
					setEmail(text);
					setEmailError(null);
					setGoogleAccountDetected(false);
					setPasswordResetSent(false);
					setRecoveryError(null);
				}}
				keyboardType="email-address"
				autoCapitalize="none"
				autoComplete="email"
				error={emailError}
			/>

			<FormTextField
				label={t("screen.login.passwordLabel")}
				value={password}
				onChangeText={(text) => {
					setPassword(text);
					setPasswordError(null);
				}}
				secureTextEntry
				autoComplete={mode === "signIn" ? "password" : "new-password"}
				error={passwordError}
			/>

			{mode === "register" && (
				<FormTextField
					label={t("screen.login.confirmPasswordLabel")}
					value={confirmPassword}
					onChangeText={(text) => {
						setConfirmPassword(text);
						setConfirmPasswordError(null);
					}}
					secureTextEntry
					autoComplete="new-password"
					error={confirmPasswordError}
				/>
			)}

			<Button
				mode="contained"
				onPress={handleSubmit}
				loading={loading}
				disabled={loading}
				icon="email"
			>
				{t(mode === "signIn" ? "screen.login.email" : "screen.login.register")}
			</Button>

			{mode === "signIn" && !googleAccountDetected && (
				<GoogleSignInButton onError={(msg) => setServerError(msg)} />
			)}

			{googleAccountDetected && (
				<View className="gap-2 mt-2">
					<GoogleSignInButton onError={(msg) => setServerError(msg)} />
					{passwordResetSent ? (
						<HelperText type="info" visible>
							{t("screen.login.setPasswordSent")}
						</HelperText>
					) : (
						<>
							<HelperText type="info" visible>
								{t("screen.login.googleAccountDetected")}
							</HelperText>
							<Button
								mode="outlined"
								onPress={handleSetPassword}
								loading={passwordResetLoading}
								disabled={passwordResetLoading}
							>
								{t("screen.login.setPassword")}
							</Button>
							{recoveryError && (
								<HelperText type="error" visible>
									{recoveryError}
								</HelperText>
							)}
						</>
					)}
				</View>
			)}

			<Button mode="text" onPress={switchMode}>
				{t(
					mode === "signIn"
						? "screen.login.switchToRegister"
						: "screen.login.switchToSignIn",
				)}
			</Button>
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.Content
					title={t(
						mode === "signIn"
							? "screen.login.title"
							: "screen.login.titleRegister",
					)}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				className="flex-1 justify-center items-center"
				style={{ paddingHorizontal: 16 }}
			>
				<View className="w-full max-w-md self-center">
					{isCompact ? (
						formContent
					) : (
						<Card mode="elevated">
							<Card.Content>{formContent}</Card.Content>
						</Card>
					)}
				</View>
			</KeyboardAvoidingView>

			<Snackbar
				visible={!!serverError}
				onDismiss={() => setServerError(null)}
				duration={4000}
				action={{ label: t("common.ok"), onPress: () => setServerError(null) }}
			>
				{serverError ?? ""}
			</Snackbar>

			<Snackbar
				visible={passwordSet === "1"}
				onDismiss={() => {}}
				duration={5000}
			>
				{t("screen.resetPassword.successMessage")}
			</Snackbar>
		</View>
	);
}
