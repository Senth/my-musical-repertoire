# Copilot Instructions

You are an expert React Native programmer using React Native Paper and NativeWind, and a professional UI/UX designer with deep knowledge of Material Design 3 (MD3).

## Styling

Prefer Paper components over NativeWind utilities, and NativeWind utilities over custom styles. Never use inline `StyleSheet.create()` when a Paper component or NativeWind class achieves the same result.

## Internationalization

All user-facing strings must use `useTranslation()` and `t()` from i18next. Never hardcode display strings.

## Imports

Use the `@/` path alias for all imports. Do not use relative paths.

## Package Manager

Use `yarn`. Do not use `npm`.

## Firebase

Follow existing patterns in `config/firebase.ts` for Auth and Firestore usage.

## Platform-Specific Code

Use `.web.tsx` / `.native.tsx` file suffixes for platform-specific implementations.
