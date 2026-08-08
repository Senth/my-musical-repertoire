import { DeleteAccountCard } from "@/components/legal/DeleteAccountCard";
import { LegalDocument } from "@/components/legal/LegalDocument";

export default function PrivacyScreen() {
	// The card renders nothing when signed out, so the page stays public.
	return (
		<LegalDocument
			documentKey="screen.privacy"
			footer={<DeleteAccountCard />}
		/>
	);
}
