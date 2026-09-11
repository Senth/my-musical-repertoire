import { View } from "react-native";
import { DeleteAccountCard } from "@/components/legal/DeleteAccountCard";
import { ExportDataCard } from "@/components/legal/ExportDataCard";
import { LegalDocument } from "@/components/legal/LegalDocument";

export default function PrivacyScreen() {
	// Both cards render nothing when signed out, so the page stays public.
	return (
		<LegalDocument
			documentKey="screen.privacy"
			footer={
				<View style={{ gap: 24 }}>
					<ExportDataCard />
					<DeleteAccountCard />
				</View>
			}
		/>
	);
}
