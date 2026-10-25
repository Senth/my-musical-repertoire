import type { TFunction } from "i18next";

export type TechniqueCatalogEntry = {
	key: string;
	type: "scale" | "arpeggio";
	tonic: string | null;
	quality:
		| "major"
		| "dominant7"
		| "harmonicMinor"
		| "melodicMinor"
		| "minor"
		| "chromatic";
	titleKey: string;
	titleParams: Record<string, string>;
};

export type TechniqueCatalogGroup = {
	key: string;
	titleKey: string;
	titleParams?: Record<string, string>;
	entries: TechniqueCatalogEntry[];
};

const KEY_PAIRS = [
	{ major: "C", minor: "A" },
	{ major: "G", minor: "E" },
	{ major: "F", minor: "D" },
	{ major: "D", minor: "B" },
	{ major: "B♭", minor: "G" },
	{ major: "A", minor: "F♯" },
	{ major: "E♭", minor: "C" },
	{ major: "E", minor: "C♯" },
	{ major: "A♭", minor: "F" },
	{ major: "B", minor: "G♯" },
	{ major: "D♭", minor: "B♭" },
	{ major: "F♯", minor: "E♭" },
] as const;

function entry(
	key: string,
	type: "scale" | "arpeggio",
	tonic: string | null,
	quality: TechniqueCatalogEntry["quality"],
	title: string,
): TechniqueCatalogEntry {
	return {
		key,
		type,
		tonic,
		quality,
		titleKey: `technique.catalog.title.${title}`,
		titleParams: tonic ? { tonic } : {},
	};
}

function entriesForKey(major: string, minor: string): TechniqueCatalogEntry[] {
	return [
		entry(`scale.major.${major}`, "scale", major, "major", "majorScale"),
		entry(
			`arpeggio.major.${major}`,
			"arpeggio",
			major,
			"major",
			"majorArpeggio",
		),
		entry(
			`arpeggio.dominant7.${major}`,
			"arpeggio",
			major,
			"dominant7",
			"dominant7Arpeggio",
		),
		entry(
			`scale.harmonicMinor.${minor}`,
			"scale",
			minor,
			"harmonicMinor",
			"harmonicMinorScale",
		),
		entry(
			`scale.melodicMinor.${minor}`,
			"scale",
			minor,
			"melodicMinor",
			"melodicMinorScale",
		),
		entry(
			`arpeggio.minor.${minor}`,
			"arpeggio",
			minor,
			"minor",
			"minorArpeggio",
		),
	];
}

const KEY_ENTRIES = KEY_PAIRS.map(({ major, minor }) =>
	entriesForKey(major, minor),
);
const CHROMATIC_ENTRY = entry(
	"scale.chromatic",
	"scale",
	null,
	"chromatic",
	"chromaticScale",
);
const CATALOG = KEY_ENTRIES.flatMap((entries, index) => [
	...entries,
	...(index === 2 ? [CHROMATIC_ENTRY] : []),
]);
const TYPE_GROUPS: {
	key: string;
	type: TechniqueCatalogEntry["type"];
	quality: TechniqueCatalogEntry["quality"];
	titleKey: string;
}[] = [
	{
		key: "scale.major",
		type: "scale",
		quality: "major",
		titleKey: "technique.catalog.group.majorScales",
	},
	{
		key: "arpeggio.major",
		type: "arpeggio",
		quality: "major",
		titleKey: "technique.catalog.group.majorArpeggios",
	},
	{
		key: "arpeggio.dominant7",
		type: "arpeggio",
		quality: "dominant7",
		titleKey: "technique.catalog.group.dominant7Arpeggios",
	},
	{
		key: "scale.harmonicMinor",
		type: "scale",
		quality: "harmonicMinor",
		titleKey: "technique.catalog.group.harmonicMinorScales",
	},
	{
		key: "scale.melodicMinor",
		type: "scale",
		quality: "melodicMinor",
		titleKey: "technique.catalog.group.melodicMinorScales",
	},
	{
		key: "arpeggio.minor",
		type: "arpeggio",
		quality: "minor",
		titleKey: "technique.catalog.group.minorArpeggios",
	},
	{
		key: "scale.chromatic",
		type: "scale",
		quality: "chromatic",
		titleKey: "technique.catalog.group.chromaticScale",
	},
];

export function catalogEntries(): TechniqueCatalogEntry[] {
	return CATALOG.map((catalogEntry) => ({
		...catalogEntry,
		titleParams: { ...catalogEntry.titleParams },
	}));
}

export function catalogTitle(
	entry: TechniqueCatalogEntry,
	t: TFunction,
): string {
	return t(entry.titleKey as Parameters<TFunction>[0], entry.titleParams);
}

export function byKey(): TechniqueCatalogGroup[] {
	const entries = catalogEntries();
	return [
		...KEY_PAIRS.map(({ major, minor }, index) => ({
			key: major,
			titleKey: "technique.catalog.group.key",
			titleParams: { major, minor },
			entries: KEY_ENTRIES[index].map((catalogEntry) => ({
				...catalogEntry,
				titleParams: { ...catalogEntry.titleParams },
			})),
		})),
		{
			key: "not-tied-to-a-key",
			titleKey: "technique.catalog.group.notTiedToKey",
			entries: entries.filter((catalogEntry) => catalogEntry.tonic === null),
		},
	];
}

export function byType(): TechniqueCatalogGroup[] {
	const entries = catalogEntries();
	return TYPE_GROUPS.map((group) => ({
		key: group.key,
		titleKey: group.titleKey,
		entries: entries.filter(
			(catalogEntry) =>
				catalogEntry.type === group.type &&
				catalogEntry.quality === group.quality,
		),
	}));
}
