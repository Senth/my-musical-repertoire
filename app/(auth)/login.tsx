import { useState } from "react";
import { View, KeyboardAvoidingView, Platform } from "react-native";
import {
  Text,
  TextInput,
  Button,
  Divider,
  Appbar,
  Snackbar,
  useTheme,
} from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { GoogleSignInButton } from "@/components/auth/GoogleSignIn";
import { FirebaseError } from "firebase/app";

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithEmail } = useAuth();
  const theme = useTheme();

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

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <Appbar.Header style={{ backgroundColor: theme.colors.primary }}>
        <Appbar.Content
          title={t("screen.login.title")}
          titleStyle={{ color: theme.colors.onPrimary }}
        />
      </Appbar.Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center items-center px-6"
      >
        <View className="w-full max-w-sm gap-4">
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

          <View className="flex-row items-center gap-4 my-2">
            <Divider className="flex-1" />
            <Text variant="bodyMedium">{t("screen.login.or")}</Text>
            <Divider className="flex-1" />
          </View>

          <GoogleSignInButton />
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
