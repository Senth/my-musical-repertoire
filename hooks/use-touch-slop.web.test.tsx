import { render } from "@testing-library/react-native";
import { useTouchSlop } from "@/hooks/use-touch-slop.web";

type Listener = (event: object) => void;
const listeners = new Map<string, Listener>();
const addEventListener = jest.fn((type: string, listener: Listener) => {
	listeners.set(type, listener);
});
const removeEventListener = jest.fn((type: string) => {
	listeners.delete(type);
});
const querySelectorAll = jest.fn();
const elementFromPoint = jest.fn();

class Control {
	parentElement: { closest: () => Control | null } | null = null;
	interactive: Control | null = null;
	exact = false;
	disabled = false;
	ariaDisabled = false;
	display = "flex";
	rect = { x: 100, y: 100, width: 34, height: 34 }; // invariants:allow
	click = jest.fn();
	getAttribute = () => (this.ariaDisabled ? "true" : null);
	matches = () => this.disabled;
	closest = (selector: string) =>
		selector.includes("data-touch-slop")
			? this.exact
				? this
				: null
			: this.interactive;
	getBoundingClientRect = () => this.rect;
	contains = (element: Control) => element === this;
}

function Probe() {
	useTouchSlop();
	return null;
}

const background = new Control();
function click(target = background, isTrusted = true) {
	listeners.get("click")?.({ target, isTrusted, clientX: 138, clientY: 117 });
}
function pointer(pointerType = "touch") {
	listeners.get("pointerdown")?.({ pointerType });
}

beforeAll(() => {
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			addEventListener,
			removeEventListener,
			querySelectorAll,
			elementFromPoint,
		},
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: Control,
	});
	Object.defineProperty(globalThis, "getComputedStyle", {
		configurable: true,
		value: (element: Control) => ({ display: element.display }),
	});
});

let control: Control;
beforeEach(() => {
	jest.clearAllMocks();
	listeners.clear();
	control = new Control();
	querySelectorAll.mockReturnValue([control]);
	elementFromPoint.mockReturnValue(control);
});

it("registers capture listeners once and removes them on unmount", async () => {
	const screen = await render(<Probe />);
	await screen.rerender(<Probe />);
	expect(addEventListener).toHaveBeenCalledTimes(2);
	expect(addEventListener).toHaveBeenCalledWith(
		"pointerdown",
		expect.any(Function),
		true,
	);
	expect(addEventListener).toHaveBeenCalledWith(
		"click",
		expect.any(Function),
		true,
	);
	await screen.unmount();
	for (const [type, listener] of addEventListener.mock.calls) {
		expect(removeEventListener).toHaveBeenCalledWith(type, listener, true);
	}
});

it("forwards a trusted touch miss once without forwarding its synthetic click", async () => {
	await render(<Probe />);
	control.click.mockImplementation(() => click(background, false));
	pointer();
	click();
	expect(control.click).toHaveBeenCalledTimes(1);
	expect(elementFromPoint).toHaveBeenCalledWith(117, 117);
	click();
	expect(control.click).toHaveBeenCalledTimes(1);
});

it.each(["mouse", "pen", ""])("leaves %s gestures alone", async (type) => {
	await render(<Probe />);
	pointer(type);
	click();
	expect(control.click).not.toHaveBeenCalled();
	expect(querySelectorAll).not.toHaveBeenCalled();
});

it("leaves direct interactive presses and synthetic clicks alone", async () => {
	await render(<Probe />);
	pointer();
	click(background, false);
	expect(control.click).not.toHaveBeenCalled();
	control.interactive = control;
	click(control);
	expect(control.click).not.toHaveBeenCalled();
	expect(querySelectorAll).not.toHaveBeenCalled();
});

it("picks the nearest eligible centre and leaves distant misses alone", async () => {
	const neighbor = new Control();
	neighbor.rect = { x: 143, y: 100, width: 34, height: 34 }; // invariants:allow
	querySelectorAll.mockReturnValue([control, neighbor]);
	elementFromPoint.mockImplementation((x: number) =>
		x === 117 ? control : neighbor,
	);
	await render(<Probe />);
	pointer();
	click();
	expect(control.click).toHaveBeenCalledTimes(1);
	expect(neighbor.click).not.toHaveBeenCalled();
	pointer();
	listeners.get("click")?.({
		target: background,
		isTrusted: true,
		clientX: 10,
		clientY: 10,
	});
	expect(control.click).toHaveBeenCalledTimes(1);
	expect(neighbor.click).not.toHaveBeenCalled();
});

it.each([
	"disabled",
	"aria-disabled",
	"zero-width",
	"zero-height",
	"inline",
	"nested",
	"exact",
	"covered",
])("does not expand %s controls", async (reason) => {
	if (reason === "disabled") control.disabled = true;
	if (reason === "aria-disabled") control.ariaDisabled = true;
	if (reason === "zero-width") control.rect.width = 0;
	if (reason === "zero-height") control.rect.height = 0;
	if (reason === "inline") control.display = "inline";
	if (reason === "nested") control.parentElement = { closest: () => control };
	if (reason === "exact") control.exact = true;
	if (reason === "covered") elementFromPoint.mockReturnValue(background);
	await render(<Probe />);
	pointer();
	click();
	expect(control.click).not.toHaveBeenCalled();
});
