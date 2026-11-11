#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
mkdir -p "$ROOT/.tmp"
TEST_DIR="$(mktemp -d "$ROOT/.tmp/dev-stack-test.XXXXXX")"
export DEV_STACK_REGISTRY="$TEST_DIR/registry"
REAL_YARN="$(command -v yarn)"
export PATH="$TEST_DIR/bin:$PATH"
FIRST="$TEST_DIR/checkout with spaces"
SECOND="$TEST_DIR/sibling"
cleanup() {
	for checkout in "$FIRST" "$SECOND"; do
		(cd "$checkout" && scripts/dev-stack.sh down) || true
	done
	rm -rf "$TEST_DIR"
}
trap cleanup EXIT
mkdir -p "$TEST_DIR/bin"
for checkout in "$FIRST" "$SECOND"; do
	mkdir -p "$checkout/scripts"
	git -C "$checkout" init -q
	cp "$ROOT/scripts/dev-stack.sh" "$ROOT/scripts/dev-ports.ts" "$checkout/scripts/"
	cp "$ROOT/firebase.json" "$ROOT/package.json" "$checkout/"
done
cat >"$TEST_DIR/bin/yarn" <<'MOCK'
#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const { spawn } = require("node:child_process");
const args = process.argv.slice(2);
if (args[0] === "start") {
  fs.writeFileSync(".tmp/dev-stack/dev-web-env.json", JSON.stringify(process.env));
  const port = args[args.indexOf("--port") + 1];
  http.createServer((req, res) => res.end("ok")).listen(port, "127.0.0.1");
} else if (args.includes("emulators:start")) {
  if (!args.includes("--project") || args[args.indexOf("--project") + 1] !== "my-musical-repertoire-dev") process.exit(1);
  const config = JSON.parse(fs.readFileSync(args[args.indexOf("--config") + 1]));
  for (const name of ["auth", "firestore", "hub", "logging"]) http.createServer((req, res) => res.end("ok")).listen(config.emulators[name].port, "127.0.0.1");
} else {
  if (process.env.MOCK_FAIL_WEB === "1") process.exit(1);
  fs.writeFileSync(".tmp/dev-stack/web-env.json", JSON.stringify(process.env));
  const port = args[args.indexOf("--port") + 1];
  const child = spawn(process.execPath, ["-e", `require("node:http").createServer((req, res) => res.end("ok")).listen(${port}, "127.0.0.1")`], { stdio: "ignore" });
  fs.writeFileSync(".tmp/dev-stack/web-child.pid", String(child.pid));
  setInterval(() => {}, 1000);
}
MOCK
chmod +x "$TEST_DIR/bin/yarn"
mkdir -p "$FIRST/node_modules/expo/bin"
cat >"$FIRST/node_modules/expo/bin/cli" <<'MOCK'
const fs = require("node:fs");
const http = require("node:http");
const port = process.argv[process.argv.indexOf("--port") + 1];
fs.writeFileSync(".tmp/dev-stack/dev-web-env.json", JSON.stringify(process.env));
http.createServer((req, res) => res.end("ok")).listen(port, "127.0.0.1");
MOCK

stack() { (cd "$1" && scripts/dev-stack.sh "${@:2}"); }

if stack "$FIRST" ports >"$TEST_DIR/output" 2>&1; then exit 1; fi
grep -q 'run `scripts/dev-stack.sh up` first' "$TEST_DIR/output"
if stack "$FIRST" env >"$TEST_DIR/output" 2>&1; then exit 1; fi

E2E_WEB_PORT=7999 stack "$FIRST" up >"$TEST_DIR/output"
[[ "$(tail -2 "$TEST_DIR/output" | head -1)" == "SEED_EMAIL=$(stack "$FIRST" fixture)" ]]
[[ "$(tail -1 "$TEST_DIR/output")" == "WEB_URL=http://localhost:$(stack "$FIRST" ports)" ]]
cp "$FIRST/.tmp/dev-stack/stack.json" "$TEST_DIR/first.json"
stack "$FIRST" up >"$TEST_DIR/output"
cmp "$FIRST/.tmp/dev-stack/stack.json" "$TEST_DIR/first.json"
stack "$FIRST" status >"$TEST_DIR/output"
[[ "$(grep -c 'alive=yes listening=yes' "$TEST_DIR/output")" == 5 ]]
FORCE_COLOR=1 stack "$FIRST" env >"$TEST_DIR/env"
[[ "$(wc -l <"$TEST_DIR/env")" == 4 ]]
grep -q "E2E_SEED_EMAIL=$(stack "$FIRST" fixture)" "$TEST_DIR/env"

stack "$SECOND" up >"$TEST_DIR/output"
node - "$FIRST" "$SECOND" "$DEV_STACK_REGISTRY" <<'CHECK'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const [first, second, registry] = process.argv.slice(2);
const names = ["web", "auth", "firestore", "hub", "logging"];
const ports = [];
for (const root of [first, second]) {
  const state = JSON.parse(fs.readFileSync(path.join(root, ".tmp/dev-stack/stack.json")));
  const config = JSON.parse(fs.readFileSync(path.join(root, ".tmp/dev-stack/firebase.json")));
  const env = JSON.parse(fs.readFileSync(path.join(root, ".tmp/dev-stack/web-env.json")));
  assert.equal(config.firestore.rules, path.join(root, "firestore.rules"));
  assert.equal(config.firestore.indexes, path.join(root, "firestore.indexes.json"));
  assert.equal(config.emulators.ui.enabled, false);
  assert.equal(env.EXPO_PUBLIC_USE_EMULATORS, "1");
  assert.equal(env.EXPO_PUBLIC_AUTH_EMULATOR_PORT, String(state.auth));
  assert.equal(env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT, String(state.firestore));
  for (const name of names) {
    const port = state[name];
    ports.push(port);
    assert.ok(port >= 7000 && port <= 7999);
    assert.equal(fs.readFileSync(path.join(registry, String(port), "worktree"), "utf8"), root);
    assert.equal(+fs.readFileSync(path.join(registry, String(port), "pid")), name === "web" ? state.webPid : state.emulatorPid);
    if (name !== "web") assert.equal(config.emulators[name].port, port);
  }
}
assert.equal(new Set(ports).size, 10);
CHECK

(cd "$FIRST" && exec setsid "$REAL_YARN" web) >"$TEST_DIR/dev-web.log" 2>&1 &
dev_web_pid=$!
dev_web_port=""
for _ in {1..50}; do
	if dev_web_port="$(stack "$FIRST" dev-port 2>/dev/null)" && curl -fsS "http://127.0.0.1:$dev_web_port" >/dev/null; then break; fi
	sleep 0.1
done
[[ "$dev_web_port" =~ ^[0-9]+$ ]] || {
	cat "$TEST_DIR/dev-web.log" >&2
	exit 1
}
node - "$FIRST/.tmp/dev-stack/stack.json" "$FIRST/.tmp/dev-stack/dev-web.json" "$FIRST/.tmp/dev-stack/dev-web-env.json" "$dev_web_port" <<'CHECK'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const [stackFile, webFile, envFile, port] = process.argv.slice(2);
const stack = JSON.parse(fs.readFileSync(stackFile));
const web = JSON.parse(fs.readFileSync(webFile));
const env = JSON.parse(fs.readFileSync(envFile));
assert.equal(web.port, +port);
assert.doesNotThrow(() => process.kill(web.pid, 0));
assert.equal(env.EXPO_PUBLIC_USE_EMULATORS, undefined);
assert.equal(env.EXPO_PUBLIC_AUTH_EMULATOR_PORT, undefined);
assert.equal(env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT, undefined);
assert.equal(new Set([stack.web, stack.auth, stack.firestore, stack.hub, stack.logging, web.port]).size, 6);
CHECK
kill -TERM -- "-$dev_web_pid"
wait "$dev_web_pid" || true
if stack "$FIRST" dev-port >"$TEST_DIR/output" 2>&1; then exit 1; fi
grep -q 'run `yarn web` first' "$TEST_DIR/output"
reclaimed_port="$(cd "$FIRST" && node scripts/dev-ports.ts alloc dev-web-reclaimed | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => console.log(JSON.parse(input)["dev-web-reclaimed"]));
')"
[[ "$reclaimed_port" == "$dev_web_port" ]]
(cd "$FIRST" && node scripts/dev-ports.ts release "$reclaimed_port")

stack "$FIRST" down
[[ ! -f "$FIRST/.tmp/dev-stack/stack.json" ]]
[[ "$(find "$DEV_STACK_REGISTRY" -mindepth 1 -maxdepth 1 -type d | wc -l)" == 5 ]]
stack "$SECOND" ports >/dev/null
stack "$SECOND" down
[[ -z "$(find "$DEV_STACK_REGISTRY" -mindepth 1 -maxdepth 1 -type d)" ]]
node - "$TEST_DIR/first.json" <<'CHECK'
const fs = require("node:fs");
const net = require("node:net");
const state = JSON.parse(fs.readFileSync(process.argv[2]));
for (const name of ["web", "auth", "firestore", "hub", "logging"]) {
  const socket = net.connect(state[name], "127.0.0.1");
  socket.once("connect", () => { process.exitCode = 1; socket.destroy(); });
  socket.once("error", () => {});
}
CHECK

stack "$FIRST" up --no-web >/dev/null
[[ "$(find "$DEV_STACK_REGISTRY" -mindepth 1 -maxdepth 1 -type d | wc -l)" == 5 ]]
if stack "$FIRST" ports >"$TEST_DIR/output" 2>&1; then exit 1; fi
stack "$FIRST" up >/dev/null
web_pid="$(node -p "require('$FIRST/.tmp/dev-stack/stack.json').webPid")"
kill -KILL "$web_pid"
stack "$FIRST" down
[[ -z "$(find "$DEV_STACK_REGISTRY" -mindepth 1 -maxdepth 1 -type d)" ]]

if MOCK_FAIL_WEB=1 stack "$FIRST" up >"$TEST_DIR/output" 2>&1; then exit 1; fi
[[ ! -f "$FIRST/.tmp/dev-stack/stack.json" ]]
[[ -z "$(find "$DEV_STACK_REGISTRY" -mindepth 1 -maxdepth 1 -type d)" ]]
stack "$FIRST" down
echo "dev-stack claims, isolation, reuse, process groups and failure cleanup: pass"
