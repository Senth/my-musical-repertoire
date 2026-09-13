/// <reference types="expo/types" />

// `expo-env.d.ts` carries this same reference, but the Expo CLI generates that
// file and gitignores it, so it exists on a developer's machine and never in
// CI — where `tsc --noEmit` would miss the Expo router types entirely.
//
// Duplicate `/// <reference>` directives are deduplicated, so keeping this
// alongside the generated file is harmless.
