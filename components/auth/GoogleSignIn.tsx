import { Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "@/config/firebase";

WebBrowser.maybeCompleteAuthSession();

const discovery = {
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export function GoogleSignInButton() {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);

	const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
	const redirectUri = AuthSession.makeRedirectUri();

	const [request, , promptAsync] = AuthSession.useAuthRequest(
		{
			clientId: clientId ?? "",
			redirectUri,
			scopes: ["openid", "profile", "email"],
			responseType: AuthSession.ResponseType.Code,
		},
		discovery,
	);

	const handleGoogleSignIn = async () => {
		if (!clientId) {
			console.warn(
				"Google Web Client ID not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env",
			);
			return;
		}

		setLoading(true);
		try {
			const result = await promptAsync();
			if (result.type === "success" && result.params.code) {
				// Exchange authorization code for tokens
				const tokenResult = await AuthSession.exchangeCodeAsync(
					{
						clientId,
						code: result.params.code,
						redirectUri,
						extraParams: {
							code_verifier: request?.codeVerifier ?? "",
						},
					},
					discovery,
				);

				if (tokenResult.idToken) {
					const credential = GoogleAuthProvider.credential(tokenResult.idToken);
					await signInWithCredential(auth, credential);
				}
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
