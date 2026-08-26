import { type ComponentProps, forwardRef } from "react";
import { View } from "react-native";
import { HelperText, TextInput } from "react-native-paper";

type TextInputRef = ComponentProps<typeof TextInput>["ref"];

type FormTextFieldProps = Omit<
	ComponentProps<typeof TextInput>,
	"error" | "ref"
> & {
	/** Localized error message, or null/undefined when valid. */
	error?: string | null;
};

/**
 * Outlined TextInput paired with an error HelperText, wrapped in a View — the
 * standard validated form field used across the add/edit screens. The forwarded
 * ref only needs `focus()` (e.g. from `useAutoFocusOnMount`).
 */
export const FormTextField = forwardRef<
	{ focus: () => void },
	FormTextFieldProps
>(function FormTextField({ error, ...props }, ref) {
	return (
		<View>
			<TextInput
				ref={ref as TextInputRef}
				mode="outlined"
				error={!!error}
				// Paper renders the floating label as a sibling element, so the
				// input itself would otherwise have no accessible name at all —
				// a screen reader reads an unlabelled box, and a test can only
				// find it by position. `aria-label`, not `accessibilityLabel`:
				// react-native-web 0.21 no longer maps the legacy spelling.
				aria-label={typeof props.label === "string" ? props.label : undefined}
				{...props}
			/>
			<HelperText type="error" visible={!!error}>
				{error ?? ""}
			</HelperText>
		</View>
	);
});
