import {
	addDoc,
	collection,
	doc,
	getDoc,
	Timestamp,
	updateDoc,
	writeBatch,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { Piece } from "@/models/piece";
import type {
	ByMode,
	PracticeMistakes,
	PracticeTrigger,
} from "@/models/practice";
import type { Section } from "@/models/section";
import { awaitWrite } from "@/utils/firestore-write";
import {
	byModeFromFirestore,
	deriveFromByMode,
	type ModeEntry,
	mergeByMode,
} from "@/utils/practice-modes";
import { computeRunThroughEffects } from "@/utils/run-through-credit";
import { useUpdatePiece } from "./use-pieces";
import { queuePhaseChange } from "./use-section-phase";

export interface SavePracticeInput {
	piece: Piece;
	/** The piece's non-archived sections, straight from the live snapshot. */
	sections: Section[];
	date: Date;
	technicalMistakes: PracticeMistakes;
	memoryMistakes: PracticeMistakes;
	achievedBpm?: number | null;
	flaggedSectionIds?: string[] | null;
	triggeredFrom?: PracticeTrigger;
	sessionId?: string | null;
	/** Free-text note for next time; stored on the piece log only (#16). */
	note?: string | null;
}

export interface SavePracticeResult {
	/** Sections moved back to `stabilizing` by this run-through. */
	demotedCount: number;
}

export function useSavePractice() {
	const { user } = useAuth();

	/**
	 * Saves a whole-piece run-through: the piece log and piece fields, plus the
	 * run-through's effect on the piece's maintenance-phase sections — credit for
	 * the ones that held together, demotion for the ones ticked as shaky.
	 *
	 * One batch for everything, so the save is atomic (never a demoted section
	 * without its piece log) and queues offline as a single unit. Section state is
	 * read from the caller's live snapshot rather than re-fetched, which keeps the
	 * save working offline where `getDoc` may reject.
	 */
	const savePractice = async ({
		piece,
		sections,
		date,
		technicalMistakes,
		memoryMistakes,
		achievedBpm,
		flaggedSectionIds,
		triggeredFrom,
		sessionId,
		note,
	}: SavePracticeInput): Promise<SavePracticeResult> => {
		if (!user) throw new Error("Not authenticated");
		const pieceId = piece.id;
		if (!pieceId) throw new Error("Piece has no id");

		const batch = writeBatch(db);
		const pieceRef = doc(db, "users", user.uid, "pieces", pieceId);
		const sectionsRef = collection(pieceRef, "sections");

		batch.set(doc(collection(pieceRef, "practiceLogs")), {
			date: Timestamp.fromDate(date),
			technicalMistakes,
			memoryMistakes,
			achievedBpm: achievedBpm ?? null,
			flaggedSectionIds: flaggedSectionIds ?? null,
			triggeredFrom: triggeredFrom ?? null,
			sessionId: sessionId ?? null,
			note: note ?? null,
		});

		batch.update(pieceRef, {
			lastPracticed: date,
			lastTechnicalMistakes: technicalMistakes,
			lastMemoryMistakes: memoryMistakes,
			...(achievedBpm != null ? { lastAchievedTempoBpm: achievedBpm } : {}),
		});

		const { credits, demotions } = computeRunThroughEffects({
			piece,
			sections,
			flaggedSectionIds: flaggedSectionIds ?? [],
			technicalMistakes,
			memoryMistakes,
			achievedBpm: achievedBpm ?? null,
			now: date,
		});

		for (const credit of credits) {
			const sectionRef = doc(sectionsRef, credit.sectionId);
			batch.set(doc(collection(sectionRef, "practiceLogs")), {
				date: Timestamp.fromDate(credit.log.date),
				quality: credit.log.quality,
				effort: credit.log.effort,
				achievedBpm: credit.log.achievedBpm,
				hands: credit.log.hands,
				drill: credit.log.drill,
				triggeredFrom: triggeredFrom ?? null,
				sessionId: sessionId ?? null,
				source: credit.log.source,
			});
			batch.update(sectionRef, {
				byMode: credit.byMode,
				lastPracticed: credit.derived.lastPracticed ?? date,
				lastQuality: credit.derived.quality,
				lastEffort: credit.derived.effort,
			});
		}

		// Demotions go through the shared helper so they stamp `phaseChangedAt`
		// and leave an audit row like every other phase change.
		for (const sectionId of demotions) {
			const demoted = sections.find((s) => s.id === sectionId);
			queuePhaseChange(batch, user.uid, {
				pieceId,
				sectionId,
				fromPhase: "maintenance",
				toPhase: "stabilizing",
				trigger: "run-through",
				achievedBpmAtEvent: achievedBpm ?? null,
				qualityAtEvent: demoted?.byMode?.HT?.quality ?? null,
				priorPhaseChangedAt: demoted?.phaseChangedAt ?? null,
				sessionId: sessionId ?? null,
				date,
			});
		}

		await awaitWrite(batch.commit());

		return { demotedCount: demotions.length };
	};

	return { savePractice };
}

export function useSaveSectionPractice() {
	const { user } = useAuth();
	const { updatePiece } = useUpdatePiece();

	/**
	 * Writes one practice log per mode, then folds them all into `byMode`.
	 * Returns the merged map so the caller can evaluate the progression nudges
	 * against what was just written rather than the stale snapshot.
	 *
	 * The note is screen-level, not per-mode: every log of the save carries it,
	 * so whichever mode the student opens next shows the same reminder (#16).
	 */
	const saveSectionPractice = async (
		pieceId: string,
		sectionId: string,
		date: Date,
		entries: ModeEntry[],
		triggeredFrom?: PracticeTrigger,
		sessionId?: string | null,
		note?: string | null,
	): Promise<ByMode | null> => {
		if (!user) throw new Error("Not authenticated");
		if (entries.length === 0) return null;

		const sectionRef = doc(
			db,
			"users",
			user.uid,
			"pieces",
			pieceId,
			"sections",
			sectionId,
		);
		const practiceLogsRef = collection(sectionRef, "practiceLogs");

		await awaitWrite(
			Promise.all(
				entries.map((entry) =>
					addDoc(practiceLogsRef, {
						date: Timestamp.fromDate(date),
						quality: entry.quality,
						effort: entry.effort,
						achievedBpm: entry.bpm ?? null,
						hands: entry.hands,
						drill: entry.drill ?? null,
						triggeredFrom: triggeredFrom ?? null,
						sessionId: sessionId ?? null,
						note: note ?? null,
					}),
				),
			),
		);

		const snap = await getDoc(sectionRef);
		const byMode = mergeByMode(
			byModeFromFirestore(snap.data()?.byMode),
			entries,
			date,
		);
		const derived = deriveFromByMode(byMode);

		await awaitWrite(
			updateDoc(sectionRef, {
				byMode,
				lastPracticed: derived.lastPracticed ?? date,
				lastQuality: derived.quality,
				lastEffort: derived.effort,
			}),
		);

		await updatePiece(pieceId, {
			lastPracticed: date,
			...(derived.bpm != null ? { lastAchievedTempoBpm: derived.bpm } : {}),
		});

		return byMode;
	};

	return { saveSectionPractice };
}
