import { initializeApp } from "firebase/app";
import { getAuth, initializeAuth } from "firebase/auth";
import {
	getFirestore,
	initializeFirestore,
	persistentLocalCache,
	persistentMultipleTabManager,
} from "firebase/firestore";
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

// IndexedDB persistence is what makes the installed PWA usable offline: reads
// come from cache and writes queue until reconnect. The multi-tab manager keeps
// the installed app and a browser tab from fighting over the lease — with the
// single-tab manager the second one to open throws `failed-precondition`.
// Native has no IndexedDB for the JS SDK, so it stays on the memory cache.
const db =
	Platform.OS === "web"
		? initializeFirestore(app, {
				localCache: persistentLocalCache({
					tabManager: persistentMultipleTabManager(),
				}),
			})
		: getFirestore(app);

export { auth, db };
