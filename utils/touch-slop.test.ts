import { touchTarget } from "@/theme/tokens";
import { pickTouchTarget, touchTargetRect } from "./touch-slop";

const smallControlSize = 34;
const wideControlWidth = 106;
const shortControlHeight = 40;

describe("touchTargetRect", () => {
	it("grows each short axis around the rect center", () => {
		expect(
			touchTargetRect({
				x: 10,
				y: 20,
				width: smallControlSize,
				height: smallControlSize,
			}),
		).toEqual({
			x: 3,
			y: 13,
			width: touchTarget.minimum,
			height: touchTarget.minimum,
		});
	});

	it("leaves axes at least 48 wide and grows only the shorter axis", () => {
		expect(
			touchTargetRect({
				x: 10,
				y: 20,
				width: wideControlWidth,
				height: shortControlHeight,
			}),
		).toEqual({
			x: 10,
			y: 16,
			width: wideControlWidth,
			height: touchTarget.minimum,
		});
	});
});

describe("pickTouchTarget", () => {
	const rect = {
		x: 0,
		y: 0,
		width: smallControlSize,
		height: smallControlSize,
	};

	it("includes points 4px outside and excludes points 8px outside", () => {
		expect(pickTouchTarget({ x: -4, y: 17 }, [rect])).toBe(0);
		expect(pickTouchTarget({ x: -8, y: 17 }, [rect])).toBeUndefined();
	});

	it("chooses nearest center and keeps list order on a tie", () => {
		const rects = [
			rect,
			{ x: 20, y: 0, width: smallControlSize, height: smallControlSize },
		];

		expect(pickTouchTarget({ x: 31, y: 17 }, rects)).toBe(1);
		expect(pickTouchTarget({ x: 27, y: 17 }, rects)).toBe(0);
	});

	it("returns no candidate for an empty list", () => {
		expect(pickTouchTarget({ x: 0, y: 0 }, [])).toBeUndefined();
	});
});
