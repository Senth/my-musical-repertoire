/** Bars shown either side of a seam, so the join has context around it. */
export const SEAM_PADDING_BARS = 1;

export interface BarRange {
	startBar: number;
	endBar: number;
}

/** First start to last end across every included section. */
export function spanBarRange(sections: BarRange[]): BarRange {
	return {
		startBar: Math.min(...sections.map((s) => s.startBar)),
		endBar: Math.max(...sections.map((s) => s.endBar)),
	};
}

/**
 * Two bars either side of where two adjacent sections meet, clamped inside
 * both:
 *
 * ```
 * [ max(A.startBar, min(A.endBar, B.startBar) - 1)
 *   .. min(B.endBar, max(A.endBar, B.startBar) + 1) ]
 * ```
 */
export function seamBarRange(a: BarRange, b: BarRange): BarRange {
	const seam = Math.min(a.endBar, b.startBar);
	return {
		startBar: Math.max(a.startBar, seam - SEAM_PADDING_BARS),
		endBar: Math.min(
			b.endBar,
			Math.max(a.endBar, b.startBar) + SEAM_PADDING_BARS,
		),
	};
}
