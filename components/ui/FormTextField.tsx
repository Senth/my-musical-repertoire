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
				{...props}
			/>
			<HelperText type="error" visible={!!error}>
				{error ?? ""}
			</HelperText>
		</View>
	);
});
