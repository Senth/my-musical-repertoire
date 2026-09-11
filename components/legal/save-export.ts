import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * Hands the export to the user through the platform share sheet, which offers
 * "save to Files" and everything else the device has. The file lives in the
 * cache directory, which the system clears on its own schedule.
 */
export async function saveExport(
	filename: string,
	contents: string,
): Promise<void> {
	const file = new File(Paths.cache, filename);
	file.write(contents);
	await Sharing.shareAsync(file.uri, {
		mimeType: "application/json",
		dialogTitle: filename,
	});
}
