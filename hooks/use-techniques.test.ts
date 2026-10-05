jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn(),
	collection: jest.fn(),
	deleteDoc: jest.fn(),
	doc: jest.fn(() => "ref"),
	getDoc: jest.fn(),
	onSnapshot: jest.fn(),
	query: jest.fn(),
	Timestamp: {},
	updateDoc: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u1" } }),
}));

import { updateDoc } from "firebase/firestore";
import type { TechniqueState } from "@/models/technique";
import { useUpdateTechnique } from "./use-techniques";

const written = () =>
	(updateDoc as jest.Mock).mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe("useUpdateTechnique dateIntroduced", () => {
	const { updateTechnique } = useUpdateTechnique();

	it.each<TechniqueState>([
		"not_started",
		"maintenance",
	])("stamps dateIntroduced when %s becomes active", async (previous) => {
		await updateTechnique("t1", { state: "active" }, previous);
		expect(written().dateIntroduced).toBeInstanceOf(Date);
	});

	it("leaves dateIntroduced alone when the technique was already active", async () => {
		await updateTechnique("t1", { state: "active" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});

	it("leaves dateIntroduced alone when the state does not become active", async () => {
		await updateTechnique("t1", { state: "maintenance" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});
});
