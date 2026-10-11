import { buildProgressRows, progressFill } from "@/utils/repertoire-progress";
import { makePiece, makeSection, makeTechnique } from "@/utils/test-factories";

it("clamps progress from 20 BPM to target", () => {
	expect(progressFill(20, 100)).toBe(0);
	expect(progressFill(10, 100)).toBe(0);
	expect(progressFill(60, 100)).toBe(0.5);
	expect(progressFill(100, 100)).toBe(1);
	expect(progressFill(120, 100)).toBe(1);
	expect(progressFill(20, 20)).toBe(1);
	expect(progressFill(10, 20)).toBe(0);
});

it("sorts by smallest fill, not absolute BPM gap, and splits rows at target in every present hand", () => {
	const piece = makePiece({ id: "p", targetTempoBpm: 120 });
	const result = buildProgressRows({
		pieces: [piece],
		sectionsByPiece: {
			p: [
				makeSection({ id: "120", pieceId: "p", byMode: { LH: { bpm: 98 } } }),
				makeSection({
					id: "72",
					pieceId: "p",
					targetBpmOverride: 72,
					byMode: { LH: { bpm: 60 }, RH: { bpm: 72 } },
				}),
				makeSection({ id: "done", pieceId: "p", byMode: { HT: { bpm: 130 } } }),
			],
		},
		techniques: [
			makeTechnique({
				id: "t",
				targetTempoBpm: 100,
				byMode: {
					HT: { bpm: 100 },
					LH: { bpm: 40 },
					RH: { bpm: null },
					"LH.staccato": { bpm: 20 },
				},
			}),
		],
	});
	expect(
		result.rows.map((row) =>
			row.kind === "section" ? row.section.id : row.technique.id,
		),
	).toEqual(["t", "72", "120"]);
	expect(result.rows[1].fill).toBeCloseTo(40 / 52);
	expect(result.rows[2].fill).toBe(0.78);
	expect(result.rows[0].hands.map(({ hands }) => hands)).toEqual(["LH", "HT"]);
	expect(result.atTarget).toHaveLength(1);
	expect(result.atTarget[0]).toMatchObject({
		kind: "section",
		section: { id: "done" },
	});
});

it("excludes dormant pieces, dormant or archived sections, dormant techniques, missing targets and plain tempos", () => {
	const section = (id: string, pieceId = "p") =>
		makeSection({ id, pieceId, byMode: { LH: { bpm: 60 } } });
	const technique = (id: string) =>
		makeTechnique({ id, targetTempoBpm: 100, byMode: { LH: { bpm: 60 } } });
	const result = buildProgressRows({
		pieces: [
			makePiece({ id: "p", targetTempoBpm: 100 }),
			makePiece({ id: "hold", state: "on_hold", targetTempoBpm: 100 }),
			makePiece({ id: "shelved", state: "shelved", targetTempoBpm: 100 }),
			makePiece({ id: "no-target" }),
			makePiece({ id: "empty", targetTempoBpm: 100 }),
		],
		sectionsByPiece: {
			p: [
				{ ...section("archived"), archived: true },
				{ ...section("dormant"), state: "not_started" },
				{ ...section("no-tempo"), byMode: { LH: { bpm: null } } },
				{ ...section("drill-only"), byMode: { "LH.staccato": { bpm: 60 } } },
				{ ...section("invalid-tempo"), byMode: { LH: { bpm: Number.NaN } } },
			],
			hold: [section("h", "hold")],
			shelved: [section("s", "shelved")],
			"no-target": [
				section("n", "no-target"),
				{ ...section("override", "no-target"), targetBpmOverride: 90 },
			],
		},
		techniques: [
			{ ...technique("retired"), state: "retired" },
			{ ...technique("dormant"), state: "not_started" },
			{ ...technique("no-target"), targetTempoBpm: null },
			{ ...technique("no-tempo"), byMode: {} },
			technique("active"),
			{ ...technique("maintenance"), state: "maintenance" },
		],
	});
	expect(
		result.rows.map((row) =>
			row.kind === "section" ? row.section.id : row.technique.id,
		),
	).toEqual(["active", "maintenance", "override"]);
	expect(result.atTarget).toEqual([]);
});

it("returns empty groups for an empty repertoire", () => {
	expect(
		buildProgressRows({ pieces: [], sectionsByPiece: {}, techniques: [] }),
	).toEqual({ rows: [], atTarget: [] });
});
