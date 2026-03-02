import { Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

WebBrowser.maybeCompleteAuthSession();

// Configure these in your .env file:
// EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id
const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export function GoogleSignInButton() {
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId ?? "",
      redirectUri: AuthSession.makeRedirectUri(),
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.IdToken,
    },
    discovery
  );

  const handleGoogleSignIn = async () => {
    if (!clientId) {
      console.warn("Google Web Client ID not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env");
      return;
    }

    setLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === "success" && result.params.id_token) {
        await signInWithGoogle(result.params.id_token);
      }
    } catch (e) {
      console.error("Google sign-in error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      mode="outlined"
      onPress={handleGoogleSignIn}
      loading={loading}
      disabled={loading || !request}
      icon="google"
    >
      {t("screen.login.google")}
    </Button>
  );
}
