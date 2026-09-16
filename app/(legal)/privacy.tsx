import { View } from "react-native";
import { DeleteAccountCard } from "@/components/legal/DeleteAccountCard";
import { ExportDataCard } from "@/components/legal/ExportDataCard";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { space } from "@/theme/tokens";

export default function PrivacyScreen() {
	// Both cards render nothing when signed out, so the page stays public.
	return (
		<LegalDocument
			documentKey="screen.privacy"
			footer={
				<View style={{ gap: space.xl }}>
					<ExportDataCard />
					<DeleteAccountCard />
				</View>
			}
		/>
	);
}
