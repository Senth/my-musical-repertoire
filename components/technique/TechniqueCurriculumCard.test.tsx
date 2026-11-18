import { fireEvent, render, waitFor } from "@testing-library/react-native";
import "@/i18n";
import type { TechniqueItem } from "@/models/technique";
import { TechniqueCurriculumCard } from "./TechniqueCurriculumCard";

const mockPush = jest.fn();
const mockAdvance = jest.fn();
const mockShowMore = jest.fn();
const mockQueue: TechniqueItem[] = [];
const mockSheetProps = {
	current: null as null | {
		candidates: TechniqueItem[];
		onShowMore?: () => Promise<boolean>;
	},
};

jest.mock("expo-router", () => ({
	useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/hooks/use-techniques", () => ({
	useAdvanceTechnique: () => ({ advance: mockAdvance }),
	useCurriculumTechniques: () => ({
		techniques: mockQueue,
		showMore: mockShowMore,
		failed: false,
	}),
	useSnoozeTechniqueNudge: () => ({ snooze: jest.fn() }),
}));

jest.mock("react-native-paper", () => {
	const actual = jest.requireActual("react-native-paper");
	return {
		...actual,
		Menu: ({ anchor }: { anchor: React.ReactNode }) => anchor,
	};
});

jest.mock("./StartTechniqueSheet", () => ({
	StartTechniqueSheet: (props: typeof mockSheetProps.current) => {
		mockSheetProps.current = props;
		return null;
	},
}));

const tech = {
	id: "c-major",
	userId: "u1",
	title: "C major scale",
	state: "active",
	dateIntroduced: new Date("2026-09-01"),
} as TechniqueItem & { id: string };

async function pressAdd() {
	const onError = jest.fn();
	const screen = await render(
		<TechniqueCurriculumCard
			tech={tech}
			nudge={{ cleanDays: 3, bpm: null, next: null }}
			onError={onError}
		/>,
	);
	fireEvent.press(screen.getByText("Add technique"));
	return onError;
}

describe("TechniqueCurriculumCard add technique", () => {
	beforeEach(() => {
		mockPush.mockClear();
		mockAdvance.mockReset();
		mockShowMore.mockReset().mockResolvedValue(undefined);
		mockQueue.splice(0, mockQueue.length, tech);
		mockSheetProps.current = null;
	});

	it("opens the add screen once the technique has moved", async () => {
		mockAdvance.mockResolvedValue(undefined);
		const onError = await pressAdd();
		await waitFor(() =>
			expect(mockPush).toHaveBeenCalledWith("/technique/add"),
		);
		expect(mockAdvance).toHaveBeenCalledWith("c-major", null);
		expect(onError).not.toHaveBeenCalled();
	});

	it("stays put and reports the error when the move fails", async () => {
		mockAdvance.mockRejectedValue(new Error("offline"));
		const onError = await pressAdd();
		await waitFor(() =>
			expect(onError).toHaveBeenCalledWith("Connection to Firebase failed"),
		);
		expect(mockPush).not.toHaveBeenCalled();
	});

	it("uses its first curriculum page for candidates and exposes Show more", async () => {
		const next = {
			...tech,
			id: "g-major",
			title: "G major scale",
			state: "not_started",
		} as TechniqueItem;
		mockQueue.push(next);
		await render(
			<TechniqueCurriculumCard
				tech={tech}
				nudge={{ cleanDays: 3, bpm: null, next }}
				onError={jest.fn()}
			/>,
		);

		expect(mockSheetProps.current?.candidates).toEqual([next]);
		expect(mockSheetProps.current?.onShowMore).toBeDefined();
		await expect(mockSheetProps.current?.onShowMore?.()).resolves.toBe(true);
		expect(mockShowMore).toHaveBeenCalledTimes(1);
	});
});
