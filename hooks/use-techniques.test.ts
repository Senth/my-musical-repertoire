jest.mock("firebase/firestore", () => ({
	addDoc: jest.fn(),
	collection: jest.fn((_db, ...path: string[]) => path.join("/")),
	deleteDoc: jest.fn(),
	doc: jest.fn((dbOrRef, ...path: string[]) =>
		[...(typeof dbOrRef === "string" ? [dbOrRef] : []), ...path].join("/"),
	),
	documentId: jest.fn(),
	getDoc: jest.fn(),
	getDocs: jest.fn(),
	limit: jest.fn(),
	onSnapshot: jest.fn(),
	orderBy: jest.fn(),
	query: jest.fn(),
	startAfter: jest.fn(),
	Timestamp: {},
	updateDoc: jest.fn(() => Promise.resolve()),
	where: jest.fn(),
	writeBatch: jest.fn(() => mockBatch),
}));

const mockBatch = {
	set: jest.fn(),
	update: jest.fn(),
	commit: jest.fn(() => Promise.resolve()),
};
jest.mock("@/config/firebase", () => ({ db: {}, auth: {} }));
jest.mock("@/contexts/AuthContext", () => ({
	useAuth: () => ({ user: { uid: "u1" } }),
}));
jest.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, params?: { tonic?: string }) => {
			const titles = jest.requireActual("@/i18n/locales/en-US.json").technique
				.catalog.title;
			return (titles[key.split(".").at(-1) ?? ""] ?? key).replace(
				"{{tonic}}",
				params?.tonic ?? "",
			);
		},
	}),
}));

import { act, renderHook } from "@testing-library/react-native";
import {
	addDoc,
	collection,
	getDocs,
	onSnapshot,
	updateDoc,
} from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "@/config/firebase";
import type { TechniqueState } from "@/models/technique";
import {
	catalogEntries,
	type TechniqueCatalogEntry,
} from "@/utils/technique-catalog";
import {
	fromFirestore,
	QUEUE_PAGE,
	useAddAllCatalog,
	useAddCatalogTechnique,
	useAddTechnique,
	useAdvanceTechnique,
	useCurriculumTechniques,
	useLinkCatalogTechnique,
	useSnoozeTechniqueNudge,
	useUpdateTechnique,
} from "./use-techniques";

const written = () =>
	(updateDoc as jest.Mock).mock.calls.at(-1)?.[1] as Record<string, unknown>;

describe("useUpdateTechnique dateIntroduced", () => {
	const { updateTechnique } = useUpdateTechnique();

	it.each<TechniqueState>(["not_started", "maintenance"])(
		"stamps dateIntroduced when %s becomes active",
		async (previous) => {
			await updateTechnique("t1", { state: "active" }, previous);
			expect(written().dateIntroduced).toBeInstanceOf(Date);
		},
	);

	it("leaves dateIntroduced alone when the technique was already active", async () => {
		await updateTechnique("t1", { state: "active" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});

	it("leaves dateIntroduced alone when the state does not become active", async () => {
		await updateTechnique("t1", { state: "maintenance" }, "active");
		expect(written()).not.toHaveProperty("dateIntroduced");
	});
});

describe("fromFirestore nudgeSnoozedUntil", () => {
	const map = (nudgeSnoozedUntil?: unknown) =>
		fromFirestore(
			"t1",
			{
				title: "C major",
				state: "active",
				dateIntroduced: { toDate: () => new Date(0) },
				nudgeSnoozedUntil,
			} as unknown as Parameters<typeof fromFirestore>[1],
			"u1",
		).nudgeSnoozedUntil;

	it("maps a stored snooze to a Date", () => {
		const until = new Date("2026-06-01T00:00:00Z");
		expect(map({ toDate: () => until })).toBe(until);
	});

	it("reads a missing snooze as null", () => {
		expect(map()).toBeNull();
	});
});

describe("curriculumKey persistence", () => {
	it("reads a missing curriculum key as null", () => {
		const technique = fromFirestore(
			"t1",
			{
				title: "C major scale",
				state: "active",
				dateIntroduced: { toDate: () => new Date(0) },
			} as unknown as Parameters<typeof fromFirestore>[1],
			"u1",
		);

		expect(technique.curriculumKey).toBeNull();
	});

	it("reads and writes a curriculum key", async () => {
		const technique = fromFirestore(
			"t1",
			{
				title: "C major scale",
				state: "active",
				dateIntroduced: { toDate: () => new Date(0) },
				curriculumKey: "scale.major.C",
			} as unknown as Parameters<typeof fromFirestore>[1],
			"u1",
		);
		const { addTechnique } = useAddTechnique();
		const { updateTechnique } = useUpdateTechnique();

		expect(technique.curriculumKey).toBe("scale.major.C");
		await addTechnique("C major scale", {
			curriculumKey: technique.curriculumKey,
		});
		expect((addDoc as jest.Mock).mock.calls[0][1]).toMatchObject({
			curriculumKey: "scale.major.C",
		});
		await updateTechnique("t1", { curriculumKey: technique.curriculumKey });
		expect(written()).toMatchObject({ curriculumKey: "scale.major.C" });
	});
});

describe("catalogue technique writes", () => {
	const entry: TechniqueCatalogEntry = {
		key: "scale.major.C",
		type: "scale",
		tonic: "C",
		quality: "major",
		titleKey: "technique.catalog.title.majorScale",
		titleParams: { tonic: "C" },
	};

	beforeEach(() => jest.clearAllMocks());

	it("adds one catalogue technique through awaitWrite", async () => {
		(addDoc as jest.Mock).mockResolvedValueOnce(undefined);
		const { result } = await renderHook(() => useAddCatalogTechnique());
		await act(async () => {
			await result.current.addCatalogTechnique(entry, "C major scale", "start");
		});
		expect(addDoc).toHaveBeenCalledWith(
			collection(db, "users", "u1", "techniques"),
			expect.objectContaining({
				curriculumKey: entry.key,
				state: "active",
				type: "scale",
				handsMode: "separate",
				activeDrills: [],
				targetTempoBpm: null,
				dateIntroduced: expect.any(Date),
			}),
		);
	});

	it("adds catalogue documents and near-match links in one batch", async () => {
		const entries = catalogEntries();
		const { result } = await renderHook(() => useAddAllCatalog());
		await act(async () => {
			await result.current.addAllCatalog(
				[entries[0], entries[6]],
				["C major scale", "G major scale"],
				[
					{
						id: "existing",
						entry: entries[3],
						rename: true,
						currentType: null,
					},
					{
						id: "kept",
						entry: entries[4],
						rename: false,
						currentType: "scale",
					},
				],
			);
		});
		expect(mockBatch.set).toHaveBeenCalledTimes(2);
		expect(mockBatch.set.mock.calls[0][1]).toMatchObject({
			state: "not_started",
			curriculumKey: entry.key,
		});
		expect(mockBatch.set.mock.calls[1][1]).toMatchObject({
			state: "not_started",
			curriculumKey: entries[6].key,
		});
		expect(
			mockBatch.set.mock.calls[1][1].dateIntroduced.getTime() -
				mockBatch.set.mock.calls[0][1].dateIntroduced.getTime(),
		).toBe(1);
		expect(mockBatch.update).toHaveBeenCalledWith(
			"users/u1/techniques/existing",
			{
				curriculumKey: entries[3].key,
				title: "A harmonic minor scale",
				type: "scale",
			},
		);
		expect(mockBatch.update).toHaveBeenCalledWith("users/u1/techniques/kept", {
			curriculumKey: entries[4].key,
		});
		expect(mockBatch.commit).toHaveBeenCalledTimes(1);
	});

	it("finishes new, linked and bulk writes offline without server acknowledgement", async () => {
		const originalOnline = Object.getOwnPropertyDescriptor(navigator, "onLine");
		const originalPlatform = Platform.OS;
		jest.replaceProperty(Platform, "OS", "web");
		Object.defineProperty(navigator, "onLine", {
			value: false,
			configurable: true,
		});
		(addDoc as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
		(updateDoc as jest.Mock).mockReturnValueOnce(new Promise(() => {}));
		mockBatch.commit.mockReturnValueOnce(new Promise(() => {}));
		try {
			const { result } = await renderHook(() => ({
				...useAddCatalogTechnique(),
				...useLinkCatalogTechnique(),
				...useAddAllCatalog(),
			}));
			await act(async () => {
				await result.current.addCatalogTechnique(
					entry,
					"C major scale",
					"later",
				);
				await result.current.linkCatalogTechnique(
					"existing",
					entry,
					false,
					null,
				);
				await result.current.addAllCatalog([entry], ["C major scale"]);
			});
			expect(addDoc).toHaveBeenCalledTimes(1);
			expect(updateDoc).toHaveBeenCalledTimes(1);
			expect(mockBatch.commit).toHaveBeenCalledTimes(1);
		} finally {
			jest.replaceProperty(Platform, "OS", originalPlatform);
			if (originalOnline)
				Object.defineProperty(navigator, "onLine", originalOnline);
			else Reflect.deleteProperty(navigator, "onLine");
		}
	});

	it("links and optionally renames without replacing a known type", async () => {
		const { result } = await renderHook(() => useLinkCatalogTechnique());
		await act(async () => {
			await result.current.linkCatalogTechnique(
				"existing",
				entry,
				true,
				"arpeggio",
			);
		});
		expect(updateDoc).toHaveBeenCalledWith("users/u1/techniques/existing", {
			curriculumKey: entry.key,
			title: "C major scale",
		});
	});
});

describe("useAdvanceTechnique", () => {
	const { advance } = useAdvanceTechnique();

	beforeEach(() => jest.clearAllMocks());

	it("moves the secure technique to maintenance and starts the next in one batch", async () => {
		await advance("from", "to");
		expect(mockBatch.update).toHaveBeenCalledWith("users/u1/techniques/from", {
			state: "maintenance",
			nudgeSnoozedUntil: null,
		});
		expect(mockBatch.update).toHaveBeenCalledWith("users/u1/techniques/to", {
			state: "active",
			dateIntroduced: expect.any(Date),
		});
		expect(mockBatch.commit).toHaveBeenCalledTimes(1);
	});

	it("only retires the secure technique when there is no next one", async () => {
		await advance("from", null);
		expect(mockBatch.update).toHaveBeenCalledTimes(1);
		expect(mockBatch.commit).toHaveBeenCalledTimes(1);
	});
});

describe("useSnoozeTechniqueNudge", () => {
	it("writes nudgeSnoozedUntil the given number of days ahead", async () => {
		const { snooze } = useSnoozeTechniqueNudge();
		const before = Date.now();
		await snooze("t1", 14);
		const until = written().nudgeSnoozedUntil as Date;
		expect(until.getTime() - before).toBeGreaterThanOrEqual(14 * 86_400_000);
		expect(until.getTime() - before).toBeLessThan(14 * 86_400_000 + 1000);
	});
});

describe("useCurriculumTechniques", () => {
	const snapshot = (...docs: [string, string][]) => ({
		size: docs.length,
		docs: docs.map(([id, state]) => ({
			id,
			data: () => ({
				title: id,
				state,
				dateIntroduced: { toDate: () => new Date(0) },
			}),
		})),
	});
	let listeners: ((snap: unknown) => void)[];
	let failures: ((error: Error) => void)[];

	beforeEach(() => {
		listeners = [];
		failures = [];
		(onSnapshot as jest.Mock).mockImplementation((_q, onNext, onError) => {
			listeners.push(onNext);
			failures.push(onError);
			return jest.fn();
		});
	});

	it("reports a failed queue read and keeps the card withheld", async () => {
		const { result } = await renderHook(() => useCurriculumTechniques(["c"]));
		const [own] = listeners;
		const [, queueFailed] = failures;
		expect(result.current.failed).toBe(false);
		await act(() => {
			own(snapshot(["c", "active"]));
			queueFailed(new Error("failed-precondition"));
		});
		expect(result.current.failed).toBe(true);
		expect(result.current.techniques).toEqual([]);
	});

	it("withholds techniques until the queue's first page has arrived", async () => {
		const { result } = await renderHook(() => useCurriculumTechniques(["c"]));
		const [own, queue] = listeners;
		await act(() => own(snapshot(["c", "active"])));
		expect(result.current.techniques).toEqual([]);
		await act(() => queue(snapshot(["g", "not_started"])));
		expect(result.current.techniques.map((t) => t.id)).toEqual(["c", "g"]);
		expect(result.current.showMore).toBeUndefined();
	});

	it("reads the queue past a full page only on Show more", async () => {
		const { result } = await renderHook(() => useCurriculumTechniques(["c"]));
		const [own, queue] = listeners;
		const page = Array.from(
			{ length: QUEUE_PAGE },
			(_, i) => [`q${i}`, "not_started"] as [string, string],
		);
		await act(() => {
			own(snapshot(["c", "active"]));
			queue(snapshot(...page));
		});
		expect(result.current.techniques).toHaveLength(QUEUE_PAGE + 1);
		(getDocs as jest.Mock).mockResolvedValue(snapshot(["late", "not_started"]));
		await act(() => result.current.showMore?.());
		expect(getDocs).toHaveBeenCalledTimes(1);
		expect(result.current.techniques.at(-1)?.id).toBe("late");
		expect(result.current.showMore).toBeUndefined();
	});

	it("opens no listener for a session without technique blocks", async () => {
		const { result } = await renderHook(() => useCurriculumTechniques([]));
		expect(listeners).toHaveLength(0);
		expect(result.current.techniques).toEqual([]);
	});
});
