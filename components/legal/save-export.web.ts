/**
 * Triggers a browser download of the export. The blob URL is revoked on a
 * delay rather than immediately: Firefox aborts a download whose URL dies
 * before the save has started.
 */
export async function saveExport(
	filename: string,
	contents: string,
): Promise<void> {
	const url = URL.createObjectURL(
		new Blob([contents], { type: "application/json" }),
	);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
