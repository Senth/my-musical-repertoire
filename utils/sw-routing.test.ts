// The service worker's routing table is plain JS served from `public/`, so it
// is required by path rather than imported through the module graph.
const { chooseStrategy } = require("@/public/sw-routing.js") as {
	chooseStrategy: (request: {
		method: string;
		mode: string;
		sameOrigin: boolean;
		pathname: string;
		search: string;
	}) => string;
};

const GET = {
	method: "GET",
	mode: "cors",
	sameOrigin: true,
	pathname: "/whatever",
	search: "",
};

describe("chooseStrategy", () => {
	it("never touches writes", () => {
		expect(chooseStrategy({ ...GET, method: "POST" })).toBe("passthrough");
	});

	it("never touches cross-origin requests", () => {
		// Firestore, Google auth and fonts manage their own offline behaviour.
		expect(chooseStrategy({ ...GET, sameOrigin: false })).toBe("passthrough");
	});

	it("passes through Firebase's reserved /__/ namespace", () => {
		expect(chooseStrategy({ ...GET, pathname: "/__/auth/handler" })).toBe(
			"passthrough",
		);
	});

	it("passes the page's build check through to the wire", () => {
		expect(
			chooseStrategy({
				...GET,
				pathname: "/",
				search: "?build-check=0",
			}),
		).toBe("passthrough");
	});

	it("leaves cross-origin navigations alone too", () => {
		expect(
			chooseStrategy({ ...GET, sameOrigin: false, mode: "navigate" }),
		).toBe("passthrough");
	});

	it("serves navigations network-first", () => {
		expect(chooseStrategy({ ...GET, mode: "navigate", pathname: "/" })).toBe(
			"navigate",
		);
	});

	it("serves content-hashed bundles cache-first", () => {
		expect(
			chooseStrategy({
				...GET,
				pathname: "/_expo/static/js/web/entry-abc123.js",
			}),
		).toBe("cache-first");
	});

	it("revalidates everything else in the background", () => {
		expect(chooseStrategy({ ...GET, pathname: "/icons/icon-192.png" })).toBe(
			"stale-while-revalidate",
		);
	});
});
