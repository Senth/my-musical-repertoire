import { useLocalSearchParams, useRouter } from "expo-router";
import { FirebaseError } from "firebase/app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Appbar, Button, HelperText, useTheme } from "react-native-paper";
import { FormTextField } from "@/components/ui/FormTextField";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordScreen() {
	const { t } = useTranslation();
	const { oobCode } = useLocalSearchParams<{ oobCode?: string }>();
	const { confirmPasswordReset } = useAuth();
	const router = useRouter();
	const theme = useTheme();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [confirmPasswordError, setConfirmPasswordError] = useState<
		string | null
	>(null);
	const [serverError, setServerError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!oobCode) {
		return (
			<View
				className="flex-1 justify-center items-center px-4"
				style={{ backgroundColor: theme.colors.background }}
			>
				<HelperText type="error" visible>
					{t("screen.resetPassword.invalidLink")}
				</HelperText>
				<Button
					mode="contained"
					onPress={() => router.replace("/(auth)/login")}
				>
					{t("screen.login.switchToSignIn")}
				</Button>
			</View>
		);
	}

	const handleSubmit = async () => {
		setPasswordError(null);
		setConfirmPasswordError(null);
		setServerError(null);

		if (password !== confirmPassword) {
			setConfirmPasswordError(t("screen.login.error.passwordMismatch"));
			return;
		}

		setLoading(true);
		try {
			await confirmPasswordReset(oobCode, password);
			router.replace({
				pathname: "/(auth)/login",
				params: { passwordSet: "1" },
			});
		} catch (e) {
			if (e instanceof FirebaseError && e.code === "auth/expired-action-code") {
				setServerError(t("screen.resetPassword.error.expired"));
			} else if (
				e instanceof FirebaseError &&
				e.code === "auth/weak-password"
			) {
				setPasswordError(t("screen.login.error.weakPassword"));
			} else {
				setServerError(t("screen.resetPassword.error.server"));
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<View
			className="flex-1"
			style={{ backgroundColor: theme.colors.background }}
		>
			<Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
				<Appbar.Content
					title={t("screen.resetPassword.title")}
					titleStyle={{ color: theme.colors.onPrimary }}
				/>
			</Appbar.Header>

			<View className="flex-1 justify-center items-center px-4">
				<View className="w-full max-w-md gap-2">
					<FormTextField
						label={t("screen.resetPassword.newPasswordLabel")}
						value={password}
						onChangeText={(text) => {
							setPassword(text);
							setPasswordError(null);
						}}
						secureTextEntry
						autoComplete="new-password"
						error={passwordError}
					/>

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

					{serverError && (
						<HelperText type="error" visible>
							{serverError}
						</HelperText>
					)}

					<Button
						mode="contained"
						onPress={handleSubmit}
						loading={loading}
						disabled={loading}
					>
						{t("screen.resetPassword.submit")}
					</Button>
				</View>
			</View>
		</View>
	);
}
