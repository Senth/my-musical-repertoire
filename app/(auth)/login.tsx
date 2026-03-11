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
	Snackbar,
	TextInput,
	useTheme,
} from "react-native-paper";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { useAuth } from "@/contexts/AuthContext";

const MD3_MEDIUM_BREAKPOINT = 600;

export default function LoginScreen() {
	const { t } = useTranslation();
	const { signInWithEmail } = useAuth();
	const theme = useTheme();
	const { width } = useWindowDimensions();
	const isCompact = width < MD3_MEDIUM_BREAKPOINT;

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleEmailSignIn = async () => {
		if (!email.trim()) {
			setError(t("screen.login.error.email"));
			return;
		}

		setLoading(true);
		setError(null);

		try {
			await signInWithEmail(email.trim(), password.trim());
		} catch (e) {
			if (e instanceof FirebaseError) {
				switch (e.code) {
					case "auth/user-not-found":
					case "auth/wrong-password":
					case "auth/invalid-credential":
						setError(t("screen.login.error.userNotFound"));
						break;
					case "auth/user-disabled":
						setError(t("screen.login.error.userDisabled"));
						break;
					default:
						setError(t("screen.login.error.server"));
				}
			} else {
				setError(t("screen.login.error.server"));
			}
		} finally {
			setLoading(false);
		}
	};

	const formContent = (
		<View className="gap-4">
			<TextInput
				label={t("screen.login.emailLabel")}
				value={email}
				onChangeText={setEmail}
				mode="outlined"
				keyboardType="email-address"
				autoCapitalize="none"
				autoComplete="email"
			/>

			<TextInput
				label={t("screen.login.passwordLabel")}
				value={password}
				onChangeText={setPassword}
				mode="outlined"
				secureTextEntry
				autoComplete="password"
			/>

			<Button
				mode="contained"
				onPress={handleEmailSignIn}
				loading={loading}
				disabled={loading}
				icon="email"
			>
				{t("screen.login.email")}
			</Button>

			<GoogleSignInButton />
		</View>
	);

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.Content
					title={t("screen.login.title")}
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
				visible={!!error}
				onDismiss={() => setError(null)}
				duration={4000}
				action={{ label: "OK", onPress: () => setError(null) }}
			>
				{error ?? ""}
			</Snackbar>
		</View>
	);
}
