/**
 * One rule for where a tempo marker's label sits: centred on its own arrow,
 * and if that would collide with the other label it sits beside the arrow
 * instead — the lower value to its arrow's left, the higher to its arrow's
 * right. Arrows stay pinned to the value they mark, and a lifted arrow does
 * not move a label: only the other label's box does.
 */

export type TempoMarkerId = "last" | "target";
export type TempoMarkerSide = "centre" | "left" | "right";

export interface TempoMark {
	id: TempoMarkerId;
	value: number;
	/** Arrow centre along the track, in px. */
	x: number;
	/** Label width, in px. */
	width: number;
}

export interface PlacedTempoMark {
	id: TempoMarkerId;
	/** The placed label box's edges along the track, in px. */
	left: number;
	right: number;
	/** Where the label ended up relative to its own arrow. */
	side: TempoMarkerSide;
	/** True when the label was pushed off its arrow by the other label. */
	anchored: boolean;
}

interface Box {
	left: number;
	right: number;
}

/** Boxes are clear when the gap between them is at least `gap`; touching collides. */
function collide(a: Box, b: Box, gap: number): boolean {
	return a.left - b.right < gap && b.left - a.right < gap;
}

function centredBox(m: TempoMark): Box {
	return { left: m.x - m.width / 2, right: m.x + m.width / 2 };
}

/** Which side of its own arrow the label prefers: lower value left, higher right. */
function preferredSide(marks: TempoMark[], m: TempoMark): "left" | "right" {
	const others = marks.filter((o) => o.id !== m.id);
	const higher = others.some((o) => o.value > m.value);
	const lower = others.some((o) => o.value < m.value);
	if (higher && !lower) return "left";
	if (lower && !higher) return "right";
	return m.id === "last" ? "left" : "right";
}

/**
 * A mark anchors when centring it would collide with another mark's label.
 * Anchored labels stop being obstacles themselves, so the set is iterated to a
 * fixed point — anchoring one can free another.
 */
function computeAnchored(marks: TempoMark[], gap: number): Set<TempoMarkerId> {
	const anchored = new Set<TempoMarkerId>();
	let grew = true;
	while (grew) {
		grew = false;
		const settled = new Set(anchored);
		for (const m of marks) {
			if (settled.has(m.id)) continue;
			const box = centredBox(m);
			const blocked = marks.some(
				(o) =>
					o.id !== m.id &&
					!settled.has(o.id) &&
					collide(box, centredBox(o), gap),
			);
			if (blocked) {
				anchored.add(m.id);
				grew = true;
			}
		}
	}
	return anchored;
}

export function placeTempoMarkers({
	trackWidth,
	gap,
	marks,
}: {
	trackWidth: number;
	gap: number;
	marks: TempoMark[];
}): PlacedTempoMark[] {
	const anchored = computeAnchored(marks, gap);

	const boxFor = (m: TempoMark, side: "left" | "right"): Box =>
		side === "left"
			? { left: m.x - m.width, right: m.x }
			: { left: m.x, right: m.x + m.width };

	const obstacles: Box[] = [];
	const inside = (b: Box) => b.left >= 0 && b.right <= trackWidth;
	const clear = (b: Box) => !obstacles.some((o) => collide(b, o, gap));

	// By position, so left marks claim their side before right ones are shoved.
	const order = [...marks].sort((a, b) => a.x - b.x);

	const placed = new Map<TempoMarkerId, Box>();
	for (const m of order) {
		const side = preferredSide(marks, m);
		const other = side === "left" ? "right" : "left";
		const desired: Box[] = anchored.has(m.id)
			? [boxFor(m, side), boxFor(m, other)]
			: [centredBox(m), boxFor(m, side), boxFor(m, other)];

		let box = desired.find((b) => inside(b) && clear(b)) ?? null;
		if (!box) {
			// Flush against whichever obstacle or edge sits nearest the
			// preferred position.
			const candidates: Box[] = [];
			for (const o of obstacles) {
				candidates.push({
					left: o.right + gap,
					right: o.right + gap + m.width,
				});
				candidates.push({ left: o.left - gap - m.width, right: o.left - gap });
			}
			candidates.push({ left: 0, right: m.width });
			candidates.push({ left: trackWidth - m.width, right: trackWidth });
			box =
				candidates
					.filter((b) => inside(b) && clear(b))
					.sort(
						(a, b) =>
							Math.abs(a.left - desired[0].left) -
							Math.abs(b.left - desired[0].left),
					)
					.at(0) ?? null;
		}
		if (!box) {
			const left = Math.max(0, Math.min(trackWidth - m.width, desired[0].left));
			box = { left, right: left + m.width };
		}
		placed.set(m.id, box);
		obstacles.push(box);
	}

	return marks.flatMap((m) => {
		const box = placed.get(m.id);
		if (!box) return [];
		const side: TempoMarkerSide =
			box.right <= m.x ? "left" : box.left >= m.x ? "right" : "centre";
		return [
			{
				id: m.id,
				left: box.left,
				right: box.right,
				side,
				anchored: anchored.has(m.id),
			},
		];
	});
}
