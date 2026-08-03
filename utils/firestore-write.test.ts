import { awaitWrite } from "./firestore-write";

jest.mock("react-native/Libraries/Utilities/Platform", () => ({
	__esModule: true,
	default: { OS: "web", select: (s: Record<string, unknown>) => s.web },
}));

function setOnLine(value: boolean) {
	Object.defineProperty(navigator, "onLine", {
		value,
		configurable: true,
		writable: true,
	});
}

/** A write that never acknowledges — what Firestore returns while offline. */
function pendingWrite(): Promise<never> {
	return new Promise(() => {});
}

describe("awaitWrite", () => {
	afterEach(() => setOnLine(true));

	it("waits for the server acknowledgement while online", async () => {
		setOnLine(true);
		let acked = false;
		await awaitWrite(
			Promise.resolve().then(() => {
				acked = true;
			}),
		);
		expect(acked).toBe(true);
	});

	it("propagates failures while online", async () => {
		setOnLine(true);
		await expect(
			awaitWrite(Promise.reject(new Error("permission-denied"))),
		).rejects.toThrow("permission-denied");
	});

	it("returns immediately offline, without waiting for the ack", async () => {
		setOnLine(false);
		// Would hang forever if it awaited: the write only settles on reconnect.
		await expect(awaitWrite(pendingWrite())).resolves.toBeUndefined();
	});

	it("swallows an offline rejection rather than leaving it unhandled", async () => {
		setOnLine(false);
		await expect(
			awaitWrite(Promise.reject(new Error("dropped"))),
		).resolves.toBeUndefined();
	});
});
