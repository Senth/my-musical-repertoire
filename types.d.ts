/// <reference types="expo/types" />

// `expo-env.d.ts` carries this same reference, but the Expo CLI generates that
// file and gitignores it, so it exists on a developer's machine and never in
// CI — where `import "./global.css"` then has no module declaration and
// `tsc --noEmit` fails on a file nobody touched.
//
// Duplicate `/// <reference>` directives are deduplicated, so keeping this
// alongside the generated file is harmless.
