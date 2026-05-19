import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	KeyboardAvoidingView,
	Platform,
	useWindowDimensions,
	View,
} from "react-native";
import {
	Appbar,
	Button,
	Card,
	HelperText,
	Snackbar,
	TextInput,
	useTheme,
} from "react-native-paper";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { useAuth } from "@/contexts/AuthContext";

const MD3_MEDIUM_BREAKPOINT = 600;

type Mode = "signIn" | "register";

export default function LoginScreen() {
	const { t } = useTranslation();
	const { signInWithEmail, registerWithEmail } = useAuth();
	const theme = useTheme();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

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

	const switchMode = () => {
		setMode((m) => (m === "signIn" ? "register" : "signIn"));
		setEmailError(null);
		setPasswordError(null);
		setConfirmPasswordError(null);
		setServerError(null);
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
			<View>
				<TextInput
					label={t("screen.login.emailLabel")}
					value={email}
					onChangeText={(text) => {
						setEmail(text);
						setEmailError(null);
					}}
					mode="outlined"
					keyboardType="email-address"
					autoCapitalize="none"
					autoComplete="email"
					error={!!emailError}
				/>
				<HelperText type="error" visible={!!emailError}>
					{emailError ?? ""}
				</HelperText>
			</View>

			<View>
				<TextInput
					label={t("screen.login.passwordLabel")}
					value={password}
					onChangeText={(text) => {
						setPassword(text);
						setPasswordError(null);
					}}
					mode="outlined"
					secureTextEntry
					autoComplete={mode === "signIn" ? "password" : "new-password"}
					error={!!passwordError}
				/>
				<HelperText type="error" visible={!!passwordError}>
					{passwordError ?? ""}
				</HelperText>
			</View>

			{mode === "register" && (
				<View>
					<TextInput
						label={t("screen.login.confirmPasswordLabel")}
						value={confirmPassword}
						onChangeText={(text) => {
							setConfirmPassword(text);
							setConfirmPasswordError(null);
						}}
						mode="outlined"
						secureTextEntry
						autoComplete="new-password"
						error={!!confirmPasswordError}
					/>
					<HelperText type="error" visible={!!confirmPasswordError}>
						{confirmPasswordError ?? ""}
					</HelperText>
				</View>
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

			{mode === "signIn" && (
				<GoogleSignInButton onError={(msg) => setServerError(msg)} />
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
		</View>
	);
}
