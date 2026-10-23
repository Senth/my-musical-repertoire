jest.mock("expo-font", () => ({
	...jest.requireActual("expo-font"),
	isLoaded: () => true,
}));
