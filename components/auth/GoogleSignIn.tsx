import { Button } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import {
	GoogleAuthProvider,
	signInWithCredential,
	signInWithPopup,
} from "firebase/auth";
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

	if (Platform.OS === "web") {
		return (
			<GoogleSignInWeb
				t={t}
				loading={loading}
				setLoading={setLoading}
			/>
		);
	}

	return (
		<GoogleSignInNative
			t={t}
			loading={loading}
			setLoading={setLoading}
			clientId={clientId}
		/>
	);
}

function GoogleSignInWeb({
	t,
	loading,
	setLoading,
}: {
	t: (key: string) => string;
	loading: boolean;
	setLoading: (v: boolean) => void;
}) {
	const handleGoogleSignIn = async () => {
		setLoading(true);
		try {
			const provider = new GoogleAuthProvider();
			provider.addScope("profile");
			provider.addScope("email");
			await signInWithPopup(auth, provider);
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
			disabled={loading}
			icon="google"
		>
			{t("screen.login.google")}
		</Button>
	);
}

function GoogleSignInNative({
	t,
	loading,
	setLoading,
	clientId,
}: {
	t: (key: string) => string;
	loading: boolean;
	setLoading: (v: boolean) => void;
	clientId: string | undefined;
}) {
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
					const credential = GoogleAuthProvider.credential(
						tokenResult.idToken,
					);
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
