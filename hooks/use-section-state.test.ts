jest.mock("firebase/firestore", () => ({
	collection: jest.fn((ref: { path: string }, name: string) => ({
		path: `${ref.path}/${name}`,
	})),
	doc: jest.fn((_db: unknown, ...path: string[]) => ({
		path: path.join("/"),
	})),
}));
jest.mock("@/config/firebase", () => ({ db: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: null }),
}));

import { stateTransitionsRef } from "@/hooks/use-section-state";

it("uses stateTransitions for state-change writes and history reads", () => {
	expect(stateTransitionsRef("u1", "p1", "s1").path).toBe(
		"users/u1/pieces/p1/sections/s1/stateTransitions",
	);
});
