import { type InstallGate, shouldOfferInstall } from "./install-gating";

/** Every condition satisfied — each case below breaks exactly one of them. */
const OFFERABLE: InstallGate = {
	promptAvailable: true,
	standalone: false,
	hasActiveSession: false,
	hasPracticed: true,
	dismissed: false,
};

describe("shouldOfferInstall", () => {
	it("offers when every condition holds", () => {
		expect(shouldOfferInstall(OFFERABLE)).toBe(true);
	});

	it("stays hidden without a captured prompt", () => {
		expect(shouldOfferInstall({ ...OFFERABLE, promptAvailable: false })).toBe(
			false,
		);
	});

	it("stays hidden when already installed", () => {
		expect(shouldOfferInstall({ ...OFFERABLE, standalone: true })).toBe(false);
	});

	it("stays hidden mid-session", () => {
		expect(shouldOfferInstall({ ...OFFERABLE, hasActiveSession: true })).toBe(
			false,
		);
	});

	it("stays hidden before the first practice", () => {
		expect(shouldOfferInstall({ ...OFFERABLE, hasPracticed: false })).toBe(
			false,
		);
	});

	it("stays hidden after a dismissal", () => {
		expect(shouldOfferInstall({ ...OFFERABLE, dismissed: true })).toBe(false);
	});
});
