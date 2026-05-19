import {
	createUserWithEmailAndPassword,
	fetchSignInMethodsForEmail,
	confirmPasswordReset as firebaseConfirmPasswordReset,
	sendPasswordResetEmail as firebaseSendPasswordResetEmail,
	signOut as firebaseSignOut,
	GoogleAuthProvider,
	onAuthStateChanged,
	signInWithCredential,
	signInWithEmailAndPassword,
	type User,
} from "firebase/auth";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { auth } from "@/config/firebase";

interface AuthContextType {
	user: User | null;
	loading: boolean;
	signInWithEmail: (email: string, password: string) => Promise<void>;
	registerWithEmail: (email: string, password: string) => Promise<void>;
	signInWithGoogle: (idToken: string) => Promise<void>;
	signOut: () => Promise<void>;
	getSignInMethodsForEmail: (email: string) => Promise<string[]>;
	sendPasswordResetEmail: (email: string) => Promise<void>;
	confirmPasswordReset: (oobCode: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			setUser(user);
			setLoading(false);
		});
		return unsubscribe;
	}, []);

	const signInWithEmail = async (email: string, password: string) => {
		await signInWithEmailAndPassword(auth, email, password);
	};

	const registerWithEmail = async (email: string, password: string) => {
		await createUserWithEmailAndPassword(auth, email, password);
	};

	const signInWithGoogle = async (idToken: string) => {
		const credential = GoogleAuthProvider.credential(idToken);
		await signInWithCredential(auth, credential);
	};

	const signOut = async () => {
		await firebaseSignOut(auth);
	};

	const getSignInMethodsForEmail = async (email: string) => {
		return fetchSignInMethodsForEmail(auth, email);
	};

	const sendPasswordResetEmail = async (email: string) => {
		await firebaseSendPasswordResetEmail(auth, email);
	};

	const confirmPasswordReset = async (oobCode: string, newPassword: string) => {
		await firebaseConfirmPasswordReset(auth, oobCode, newPassword);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				loading,
				signInWithEmail,
				registerWithEmail,
				signInWithGoogle,
				signOut,
				getSignInMethodsForEmail,
				sendPasswordResetEmail,
				confirmPasswordReset,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
