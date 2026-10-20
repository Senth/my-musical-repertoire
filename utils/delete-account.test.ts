const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

/** Documents keyed by collection path, e.g. `users/u1/pieces`. */
const tree: Record<string, string[]> = {};

jest.mock("firebase/firestore", () => ({
	collection: jest.fn((ref: { path: string }, name: string) => ({
		path: `${ref.path}/${name}`,
	})),
	doc: jest.fn((parent: { path?: string }, ...path: string[]) => ({
		path: [parent.path, ...path].filter(Boolean).join("/"),
	})),
	getDocs: jest.fn(async (ref: { path: string }) => ({
		docs: (tree[ref.path] ?? []).map((id) => ({
			id,
			ref: { path: `${ref.path}/${id}` },
		})),
	})),
	writeBatch: jest.fn(() => ({
		delete: mockBatchDelete,
		commit: mockBatchCommit,
	})),
}));
jest.mock("@/config/firebase", () => ({ db: {} }));

import { deleteAllUserData } from "@/utils/delete-account";

const deletedPaths = () =>
	mockBatchDelete.mock.calls.map(([ref]) => (ref as { path: string }).path);

beforeEach(() => {
	for (const key of Object.keys(tree)) delete tree[key];
	mockBatchDelete.mockClear();
	mockBatchCommit.mockClear();
	mockBatchCommit.mockResolvedValue(undefined);
});

describe("deleteAllUserData", () => {
	it("walks every subcollection so nothing is orphaned", async () => {
		tree["users/u1/pieces"] = ["p1"];
		tree["users/u1/pieces/p1/sections"] = ["s1"];
		tree["users/u1/pieces/p1/sections/s1/practiceLogs"] = ["sl1"];
		tree["users/u1/pieces/p1/sections/s1/phaseTransitions"] = ["st1"];
		tree["users/u1/pieces/p1/sections/s1/stateTransitions"] = ["st2"];
		tree["users/u1/pieces/p1/practiceLogs"] = ["pl1"];
		tree["users/u1/techniques"] = ["t1"];
		tree["users/u1/techniques/t1/practiceLogs"] = ["tl1"];
		tree["users/u1/sessionPresets"] = ["pr1"];
		tree["users/u1/sightReadingLogs"] = ["sr1"];

		await deleteAllUserData("u1");

		expect(deletedPaths().sort()).toEqual(
			[
				"users/u1/pieces/p1",
				"users/u1/pieces/p1/practiceLogs/pl1",
				"users/u1/pieces/p1/sections/s1",
				"users/u1/pieces/p1/sections/s1/practiceLogs/sl1",
				"users/u1/pieces/p1/sections/s1/phaseTransitions/st1",
				"users/u1/pieces/p1/sections/s1/stateTransitions/st1",
				"users/u1/pieces/p1/sections/s1/stateTransitions/st2",
				"users/u1/sessionPresets/pr1",
				"users/u1/sightReadingLogs/sr1",
				"users/u1/techniques/t1",
				"users/u1/techniques/t1/practiceLogs/tl1",
			].sort(),
		);
	});

	it("deletes children before their parent", async () => {
		tree["users/u1/pieces"] = ["p1"];
		tree["users/u1/pieces/p1/sections"] = ["s1"];
		tree["users/u1/pieces/p1/sections/s1/practiceLogs"] = ["sl1"];
		tree["users/u1/pieces/p1/sections/s1/phaseTransitions"] = ["st1"];
		tree["users/u1/pieces/p1/sections/s1/stateTransitions"] = ["st2"];

		await deleteAllUserData("u1");

		const paths = deletedPaths();
		expect(paths).toContain(
			"users/u1/pieces/p1/sections/s1/stateTransitions/st2",
		);
		expect(
			paths.indexOf("users/u1/pieces/p1/sections/s1/stateTransitions/st2"),
		).toBeLessThan(paths.indexOf("users/u1/pieces/p1/sections/s1"));
		expect(paths).toContain(
			"users/u1/pieces/p1/sections/s1/phaseTransitions/st1",
		);
		expect(
			paths.indexOf("users/u1/pieces/p1/sections/s1/phaseTransitions/st1"),
		).toBeLessThan(paths.indexOf("users/u1/pieces/p1/sections/s1"));
		expect(
			paths.indexOf("users/u1/pieces/p1/sections/s1/practiceLogs/sl1"),
		).toBeLessThan(paths.indexOf("users/u1/pieces/p1/sections/s1"));
		expect(paths.indexOf("users/u1/pieces/p1/sections/s1")).toBeLessThan(
			paths.indexOf("users/u1/pieces/p1"),
		);
	});

	it("splits into batches under the Firestore write cap", async () => {
		tree["users/u1/pieces"] = Array.from({ length: 500 }, (_, i) => `p${i}`);

		await deleteAllUserData("u1");

		expect(mockBatchDelete).toHaveBeenCalledTimes(500);
		expect(mockBatchCommit).toHaveBeenCalledTimes(2);
	});

	it("removes a target copied after enumeration even across a batch boundary", async () => {
		const section = "users/u1/pieces/p1/sections/s1";
		const source = `${section}/phaseTransitions/st1`;
		const target = `${section}/stateTransitions/st1`;
		tree["users/u1/pieces"] = ["p1"];
		tree["users/u1/pieces/p1/sections"] = ["s1"];
		tree[`${section}/practiceLogs`] = Array.from(
			{ length: 449 },
			(_, i) => `l${i}`,
		);
		tree[`${section}/phaseTransitions`] = ["st1"];
		const stored = new Set([source]);
		let committed = 0;
		mockBatchCommit.mockImplementation(async () => {
			if (stored.has(source)) stored.add(target);
			for (const path of deletedPaths().slice(committed)) stored.delete(path);
			committed = deletedPaths().length;
		});

		await deleteAllUserData("u1");

		expect(stored.has(source)).toBe(false);
		expect(stored.has(target)).toBe(false);
		expect(deletedPaths().indexOf(source)).toBeLessThan(
			deletedPaths().indexOf(target),
		);
		expect(mockBatchCommit).toHaveBeenCalledTimes(2);
	});

	it("commits nothing when the account is empty", async () => {
		await deleteAllUserData("u1");

		expect(mockBatchCommit).not.toHaveBeenCalled();
	});
});
