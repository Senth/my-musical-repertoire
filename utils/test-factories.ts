import type { Piece } from "@/models/piece";
import type { Section } from "@/models/section";
import type { TechniqueItem } from "@/models/technique";

/** Build a Piece for tests. Any field can be overridden via `over`. */
export function makePiece(over: Partial<Piece> & { id: string }): Piece {
	return {
		userId: "u",
		title: `Piece ${over.id}`,
		composer: "C",
		state: "learning",
		targetTempoBpm: null,
		lastPracticed: null,
		lastAchievedTempoBpm: null,
		sectionCount: 0,
		...over,
	};
}

/** Build a Section for tests. Any field can be overridden via `over`. */
export function makeSection(
	over: Partial<Section> & { id: string; pieceId: string },
): Section {
	return {
		userId: "u",
		label: "Sec",
		order: 0,
		phase: "learning",
		archived: false,
		startBar: null,
		endBar: null,
		currentBpm: null,
		targetBpmOverride: null,
		notes: null,
		createdAt: null,
		lastPracticed: null,
		...over,
	};
}

/** Build a TechniqueItem for tests. Any field can be overridden via `over`. */
export function makeTechnique(
	over: Partial<TechniqueItem> & { id: string },
): TechniqueItem {
	return {
		userId: "u",
		title: `T ${over.id}`,
		state: "active",
		type: null,
		targetTempoBpm: null,
		dateIntroduced: new Date("2026-01-01T00:00:00Z"),
		lastPracticedAt: null,
		lastQuality: null,
		lastEffort: null,
		lastAchievedTempoBpm: null,
		...over,
	};
}
