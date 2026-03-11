import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Replace these values with your Firebase project config.
// You can find them in the Firebase Console > Project Settings > Web App.
const firebaseConfig = {
	apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
	authDomain:
		process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
		"my-musical-repertoire-dev.firebaseapp.com",
	projectId:
		process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "my-musical-repertoire-dev",
	storageBucket:
		process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
		"my-musical-repertoire-dev.appspot.com",
	messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
	appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

const app = initializeApp(firebaseConfig);

const auth = Platform.OS === "web" ? getAuth(app) : initializeAuth(app);
const db = getFirestore(app);

export { app, auth, db };
