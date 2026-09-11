/** Documents keyed by collection path, e.g. `users/u1/pieces`. */
const mockTree: Record<
	string,
	Array<{ id: string; data: () => Record<string, unknown> }>
> = {};

jest.mock("firebase/firestore", () => {
	class MockTimestamp {
		constructor(private readonly mockSeconds: number) {}

		toDate(): Date {
			return new Date(this.mockSeconds * 1000);
		}
	}

	return {
		Timestamp: MockTimestamp,
		collection: jest.fn((ref: { path: string }, name: string) => ({
			path: `${ref.path}/${name}`,
		})),
		doc: jest.fn((_db: unknown, ...path: string[]) => ({
			path: path.join("/"),
		})),
		getDocs: jest.fn(async (ref: { path: string }) => ({
			docs: (mockTree[ref.path] ?? []).map(({ id, data }) => ({
				id,
				ref: { path: `${ref.path}/${id}` },
				data,
			})),
		})),
	};
});
jest.mock("@/config/firebase", () => ({ db: {} }));

import { Timestamp } from "firebase/firestore";
import { collectExportData } from "./export-data";

beforeEach(() => {
	for (const key of Object.keys(mockTree)) delete mockTree[key];
});

describe("collectExportData", () => {
	it("reads every collection, children nested under their parents", async () => {
		mockTree["users/u1/pieces"] = [
			{ id: "p1", data: () => ({ title: "Gymnopédie No. 1" }) },
		];
		mockTree["users/u1/pieces/p1/sections"] = [
			{ id: "s1", data: () => ({ label: "A" }) },
		];
		mockTree["users/u1/pieces/p1/sections/s1/practiceLogs"] = [
			{ id: "sl1", data: () => ({ accuracy: 0.9 }) },
		];
		mockTree["users/u1/pieces/p1/practiceLogs"] = [
			{ id: "pl1", data: () => ({ accuracy: 1 }) },
		];
		mockTree["users/u1/techniques"] = [
			{ id: "t1", data: () => ({ name: "C major scale" }) },
		];
		mockTree["users/u1/techniques/t1/practiceLogs"] = [
			{ id: "tl1", data: () => ({ accuracy: 0.8 }) },
		];
		mockTree["users/u1/sessionPresets"] = [
			{ id: "pr1", data: () => ({ name: "Balanced" }) },
		];

		const data = await collectExportData("u1");

		expect(data.pieces).toEqual([
			{
				id: "p1",
				title: "Gymnopédie No. 1",
				sections: [
					{
						id: "s1",
						label: "A",
						practiceLogs: [{ id: "sl1", accuracy: 0.9 }],
					},
				],
				practiceLogs: [{ id: "pl1", accuracy: 1 }],
			},
		]);
		expect(data.techniques).toEqual([
			{
				id: "t1",
				name: "C major scale",
				practiceLogs: [{ id: "tl1", accuracy: 0.8 }],
			},
		]);
		expect(data.sessionPresets).toEqual([{ id: "pr1", name: "Balanced" }]);
	});

	it("renders Firestore timestamps as ISO 8601", async () => {
		mockTree["users/u1/pieces"] = [
			{
				id: "p1",
				data: () => ({
					lastPracticed: new Timestamp(Date.UTC(2026, 8, 11, 7, 30) / 1000, 0),
				}),
			},
		];

		const data = await collectExportData("u1");

		expect(data.pieces[0].lastPracticed).toBe("2026-09-11T07:30:00.000Z");
	});

	it("reports an empty account as empty arrays, not an error", async () => {
		const data = await collectExportData("u1");

		expect(data.pieces).toEqual([]);
		expect(data.techniques).toEqual([]);
		expect(data.sessionPresets).toEqual([]);
		expect(typeof data.exportedAt).toBe("string");
		expect(data.app).toBe("my-musical-repertoire");
	});
});
