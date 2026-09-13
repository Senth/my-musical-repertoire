import {
	MD3DarkTheme,
	MD3LightTheme,
	type MD3Theme,
	useTheme,
} from "react-native-paper";

/**
 * The app's theme: MD3 plus the non-MD3 roles this app adds — `warning` and
 * `success` — so consumers never re-declare the intersection locally.
 */
export type AppTheme = MD3Theme & {
	colors: MD3Theme["colors"] & {
		warning: string;
		onWarning: string;
		warningContainer: string;
		onWarningContainer: string;
		success: string;
		onSuccess: string;
		successContainer: string;
		onSuccessContainer: string;
	};
};

export const lightTheme: AppTheme = {
	...MD3LightTheme,
	colors: {
		...MD3LightTheme.colors,
		primary: "#006566",
		onPrimary: "#FFFFFF",
		primaryContainer: "#BCE8E7",
		onPrimaryContainer: "#002829",
		secondary: "#3B6363",
		onSecondary: "#FFFFFF",
		secondaryContainer: "#CDE8E7",
		onSecondaryContainer: "#052A2A",
		surface: "#FCFCFC",
		background: "#FCFCFC",
		surfaceVariant: "#E3E3E3",
		outline: "#767676",
		outlineVariant: "#C7C7C7",
		elevation: {
			level0: "transparent",
			level1: "#EFF4F4",
			level2: "#E8F0F0",
			level3: "#E0EBEC",
			level4: "#DEEAEA",
			level5: "#D9E7E7",
		},
		warning: "#B45309",
		onWarning: "#FFFFFF",
		warningContainer: "#FEF3C7",
		onWarningContainer: "#78350F",
		success: "#047857",
		onSuccess: "#FFFFFF",
		successContainer: "#D1FAE5",
		onSuccessContainer: "#064E3B",
	},
};

export const darkTheme: AppTheme = {
	...MD3DarkTheme,
	colors: {
		...MD3DarkTheme.colors,
		primary: "#7BDAD9",
		onPrimary: "#003232",
		primaryContainer: "#00494A",
		onPrimaryContainer: "#BCE8E7",
		secondary: "#AAD0CF",
		onSecondary: "#162E2D",
		secondaryContainer: "#264343",
		onSecondaryContainer: "#CAE4E4",
		surface: "#1C1C1C",
		background: "#1C1C1C",
		surfaceVariant: "#474747",
		outline: "#919191",
		outlineVariant: "#474747",
		elevation: {
			level0: "transparent",
			level1: "#212625",
			level2: "#242B2B",
			level3: "#263131",
			level4: "#273333",
			level5: "#293736",
		},
		warning: "#FCD34D",
		onWarning: "#78350F",
		warningContainer: "#92400E",
		onWarningContainer: "#FEF3C7",
		success: "#34D399",
		onSuccess: "#064E3B",
		successContainer: "#065F46",
		onSuccessContainer: "#D1FAE5",
	},
};

/** The app's typed theme hook: `useTheme` plus the `warning`/`success` roles. */
export function useAppTheme(): AppTheme {
	return useTheme<AppTheme>();
}
