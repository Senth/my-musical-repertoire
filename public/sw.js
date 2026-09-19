/**
 * Hand-rolled runtime-caching service worker — no Workbox, no precache
 * manifest, no build step. Assets are cached the first time they are used,
 * which is enough because the app cannot be used before signing in online once.
 *
 * The worker takes over as soon as it installs (`skipWaiting()` in `install`,
 * `clients.claim()` in `activate`). Taking over is not the same as swapping the
 * page out from under the user: the new caching rules apply to what this worker
 * serves from then on, while the page that is already open keeps running until
 * it decides otherwise. That second decision — reload now or offer the banner —
 * is owned by `hooks/use-service-worker.web.ts`, which compares the build the
 * page is running against the one on the wire and never touches a session.
 *
 * Bump `VERSION` whenever this file changes, so `activate` drops the old cache.
 */

importScripts("./sw-routing.js");

const VERSION = "v3";
const CACHE = `repertoire-${VERSION}`;
/** Prerendered root page; also the offline fallback for routes never visited. */
const SHELL_URL = "/";
const PRECACHE_URLS = [SHELL_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE_URLS))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	const url = new URL(request.url);
	const strategy = chooseStrategy({
		method: request.method,
		mode: request.mode,
		sameOrigin: url.origin === self.location.origin,
		pathname: url.pathname,
		search: url.search,
	});

	switch (strategy) {
		case "passthrough":
			return;
		case "navigate":
			event.respondWith(networkFirst(request));
			return;
		case "cache-first":
			event.respondWith(cacheFirst(request));
			return;
		default:
			event.respondWith(staleWhileRevalidate(event));
	}
});

/** Cache-writable responses only: a redirect or an error must not be stored. */
function isCacheable(response) {
	// `cache.put` throws on a redirected response, which would reject the
	// `respondWith` promise and paint a browser error page instead of the app.
	return (
		Boolean(response) &&
		response.ok &&
		response.type !== "opaque" &&
		!response.redirected
	);
}

async function networkFirst(request) {
	const cache = await caches.open(CACHE);
	// Key navigations by pathname, not one shared shell: each exported route has
	// its own prerender, and an offline relaunch must be served the prerender of
	// the route it opens — a foreign route's markup trips React hydration (#418).
	// The query is dropped on purpose: the exported HTML does not vary with it.
	const key = new URL(request.url).pathname;
	try {
		// Bypass the browser HTTP cache: an hour-old shell naming an hour-old
		// bundle is exactly the stale build this worker exists to prevent.
		const response = await fetch(request, { cache: "no-store" });
		if (isCacheable(response)) await cache.put(key, response.clone());
		return response;
	} catch {
		// A route visited online before has its own prerender. For one that has
		// not, the root prerender is the least wrong answer: the client re-renders
		// the right route from the bundle, which beats a browser error page.
		return (
			(await cache.match(key)) ??
			(await cache.match(SHELL_URL)) ??
			Response.error()
		);
	}
}

async function cacheFirst(request) {
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (isCacheable(response)) await cache.put(request, response.clone());
	return response;
}

async function staleWhileRevalidate(event) {
	const request = event.request;
	const cache = await caches.open(CACHE);
	const cached = await cache.match(request);

	const revalidated = fetch(request)
		.then(async (response) => {
			if (isCacheable(response)) await cache.put(request, response.clone());
			return response;
		})
		.catch(() => undefined);

	if (cached) {
		// Keep the worker alive for the background refresh after we have answered.
		event.waitUntil(revalidated);
		return cached;
	}
	return (await revalidated) ?? Response.error();
}
