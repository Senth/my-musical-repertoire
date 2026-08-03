// Native variant of use-wake-lock.web.ts, resolved by Metro on native; not reachable from fallow's web entry points.
// fallow-ignore-file unused-file

/**
 * No-op on native. Keeping the screen awake there needs `expo-keep-awake`,
 * which the app does not depend on — the web/PWA build is what runs on the
 * music desk.
 */
export function useWakeLock(_enabled: boolean): void {}
