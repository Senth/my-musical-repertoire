/**
 * Composer line for read-only piece displays: `Composer · Collection`, falling
 * back to the composer alone when no collection is set.
 */
export function formatComposerLine(
	composer: string,
	collectionName?: string | null,
): string {
	const collection = collectionName?.trim();
	return collection ? `${composer} · ${collection}` : composer;
}
