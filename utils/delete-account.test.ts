const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

/** Documents keyed by collection path, e.g. `users/u1/pieces`. */
const tree: Record<string, string[]> = {};

jest.mock("firebase/firestore", () => ({
	collection: jest.fn((ref: { path: string }, name: string) => ({
		path: `${ref.path}/${name}`,
	})),
	doc: jest.fn((_db: unknown, ...path: string[]) => ({
		path: path.join("/"),
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

import { deleteAllUserData } from "./delete-account";

const deletedPaths = () =>
	mockBatchDelete.mock.calls.map(([ref]) => (ref as { path: string }).path);

beforeEach(() => {
	for (const key of Object.keys(tree)) delete tree[key];
	mockBatchDelete.mockClear();
	mockBatchCommit.mockClear();
});

describe("deleteAllUserData", () => {
	it("walks every subcollection so nothing is orphaned", async () => {
		tree["users/u1/pieces"] = ["p1"];
		tree["users/u1/pieces/p1/sections"] = ["s1"];
		tree["users/u1/pieces/p1/sections/s1/practiceLogs"] = ["sl1"];
		tree["users/u1/pieces/p1/practiceLogs"] = ["pl1"];
		tree["users/u1/techniques"] = ["t1"];
		tree["users/u1/techniques/t1/practiceLogs"] = ["tl1"];
		tree["users/u1/sessionPresets"] = ["pr1"];

		await deleteAllUserData("u1");

		expect(deletedPaths().sort()).toEqual(
			[
				"users/u1/pieces/p1",
				"users/u1/pieces/p1/practiceLogs/pl1",
				"users/u1/pieces/p1/sections/s1",
				"users/u1/pieces/p1/sections/s1/practiceLogs/sl1",
				"users/u1/sessionPresets/pr1",
				"users/u1/techniques/t1",
				"users/u1/techniques/t1/practiceLogs/tl1",
			].sort(),
		);
	});

	it("deletes children before their parent", async () => {
		tree["users/u1/pieces"] = ["p1"];
		tree["users/u1/pieces/p1/sections"] = ["s1"];
		tree["users/u1/pieces/p1/sections/s1/practiceLogs"] = ["sl1"];

		await deleteAllUserData("u1");

		const paths = deletedPaths();
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

	it("commits nothing when the account is empty", async () => {
		await deleteAllUserData("u1");

		expect(mockBatchCommit).not.toHaveBeenCalled();
	});
});
