import { makePiece, makeSection, makeTechnique } from "./test-factories";

describe("makePiece", () => {
	it("fills defaults from the id", () => {
		expect(makePiece({ id: "p1" })).toMatchObject({
			id: "p1",
			userId: "u",
			title: "Piece p1",
			composer: "C",
			state: "learning",
			targetTempoBpm: null,
			lastPracticed: null,
			lastAchievedTempoBpm: null,
			sectionCount: 0,
		});
	});

	it("lets any field be overridden", () => {
		const piece = makePiece({
			id: "p2",
			title: "Clair de lune",
			state: "maintenance",
		});
		expect(piece.title).toBe("Clair de lune");
		expect(piece.state).toBe("maintenance");
	});
});

describe("makeSection", () => {
	it("fills defaults from the ids", () => {
		expect(makeSection({ id: "s1", pieceId: "p1" })).toMatchObject({
			id: "s1",
			pieceId: "p1",
			userId: "u",
			label: "Sec",
			order: 0,
			phase: "learning",
			archived: false,
			byMode: {},
		});
	});

	it("lets any field be overridden", () => {
		const section = makeSection({
			id: "s2",
			pieceId: "p1",
			order: 3,
			phase: "stabilizing",
		});
		expect(section.order).toBe(3);
		expect(section.phase).toBe("stabilizing");
	});
});

describe("makeTechnique", () => {
	it("fills defaults from the id", () => {
		expect(makeTechnique({ id: "t1" })).toMatchObject({
			id: "t1",
			userId: "u",
			title: "T t1",
			state: "active",
			dateIntroduced: new Date("2026-01-01T00:00:00Z"),
			handsMode: "separate",
			activeDrills: [],
			byMode: {},
		});
	});

	it("lets any field be overridden", () => {
		const technique = makeTechnique({
			id: "t2",
			state: "retired",
			lastQuality: 4,
		});
		expect(technique.state).toBe("retired");
		expect(technique.lastQuality).toBe(4);
	});
});
