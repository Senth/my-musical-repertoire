import { touchTarget } from "@/theme/tokens";

type Rect = { x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };

export function touchTargetRect(rect: Rect): Rect {
	const width = Math.max(rect.width, touchTarget.minimum);
	const height = Math.max(rect.height, touchTarget.minimum);

	return {
		x: rect.x - (width - rect.width) / 2,
		y: rect.y - (height - rect.height) / 2,
		width,
		height,
	};
}

export function pickTouchTarget(
	point: Point,
	rects: readonly Rect[],
): number | undefined {
	let nearestIndex: number | undefined;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < rects.length; index++) {
		const rect = rects[index];
		const box = touchTargetRect(rect);
		if (
			point.x < box.x ||
			point.x > box.x + box.width ||
			point.y < box.y ||
			point.y > box.y + box.height
		) {
			continue;
		}

		const dx = point.x - (rect.x + rect.width / 2);
		const dy = point.y - (rect.y + rect.height / 2);
		const distance = dx * dx + dy * dy;
		if (distance < nearestDistance) {
			nearestIndex = index;
			nearestDistance = distance;
		}
	}

	return nearestIndex;
}
