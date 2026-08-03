import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

/**
 * The static HTML shell every exported web page is rendered into. Runs in Node
 * during `expo export`, never in the browser, so it cannot use client hooks.
 *
 * Based on Expo Router's default shell — `ScrollViewStyleReset` and the base
 * metas have to stay, or the root `ScrollView` loses native parity. Everything
 * else here is the PWA layer: manifest, icons, and theme colours.
 */
export default function Root({ children }: PropsWithChildren) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta httpEquiv="X-UA-Compatible" content="IE=edge" />
				{/* `interactive-widget=resizes-content` makes the soft keyboard shrink
				    the layout instead of sliding it up, which would push the coach's
				    sticky timer bar and Save button off screen. */}
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, shrink-to-fit=no, interactive-widget=resizes-content"
				/>

				<link rel="manifest" href="/manifest.webmanifest" />
				{/* Matches the `primary` colours in app/_layout.tsx. */}
				<meta
					name="theme-color"
					content="#7B1FA2"
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content="#CE93D8"
					media="(prefers-color-scheme: dark)"
				/>

				{/* iOS reads these instead of the manifest for install + home screen. */}
				<link rel="apple-touch-icon" href="/icons/icon-192.png" />
				<meta name="apple-mobile-web-app-capable" content="yes" />
				<meta name="mobile-web-app-capable" content="yes" />
				<meta name="apple-mobile-web-app-status-bar-style" content="default" />
				<meta name="apple-mobile-web-app-title" content="Repertoire" />

				<ScrollViewStyleReset />
			</head>
			<body>{children}</body>
		</html>
	);
}
