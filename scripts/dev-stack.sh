#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
CHECKOUT_ID="$(printf '%s' "$ROOT" | sha256sum | cut -c1-6)"
SEED_EMAIL="pianist-$CHECKOUT_ID@example.com"
RUN_DIR="$ROOT/.tmp/dev-stack"
STATE="$RUN_DIR/stack.json"
DEV_WEB_STATE="$RUN_DIR/dev-web.json"
WEB_PORT=0 AUTH_PORT=0 FIRESTORE_PORT=0 FIRESTORE_WEBSOCKET_PORT=0 HUB_PORT=0 LOGGING_PORT=0
EMULATOR_PID=0 WEB_PID=0 EMULATOR_START="" WEB_START=""
LEASE="" EMULATOR_GROUPS=""
DEV_WEB_PORT=0 DEV_WEB_PID=0 DEV_WEB_START=""

ports() { node "$ROOT/scripts/dev-ports.ts" "$@"; }
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

process_start() {
	local stat
	local -a fields
	stat="$(cat "/proc/$1/stat" 2>/dev/null)" || return 1
	read -r -a fields <<<"${stat##*) }"
	[[ "${fields[0]}" != Z ]] || return 1
	printf '%s:%s\n' "$(cat /proc/sys/kernel/random/boot_id)" "${fields[19]}"
}

alive() {
	[[ "$1" -gt 0 && -n "$2" ]] && [[ "$(process_start "$1" || true)" == "$2" ]]
}

read_state() {
	[[ -f "$STATE" ]] || return 1
	read -r WEB_PORT AUTH_PORT FIRESTORE_PORT FIRESTORE_WEBSOCKET_PORT HUB_PORT LOGGING_PORT EMULATOR_PID WEB_PID EMULATOR_START WEB_START LEASE EMULATOR_GROUPS < <(
		node -e '
const state = require(process.argv[1]);
const keys = ["web", "auth", "firestore", "firestoreWebsocket", "hub", "logging", "emulatorPid", "webPid"];
if (keys.some(key => !Number.isInteger(state[key]) || state[key] < 0) || !state.lease) process.exit(1);
console.log([...keys.map(key => state[key]), state.emulatorStart || "-", state.webStart || "-", state.lease, ...(state.emulatorGroups || []).map(group => `${group.pid}@${group.start}`)].join(" "));
' "$STATE"
	)
}

read_dev_web_state() {
	[[ -f "$DEV_WEB_STATE" ]] || return 1
	local state
	state="$(node -e '
const state = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
if (!Number.isInteger(state.port) || state.port < 7000 || state.port > 7999 || !Number.isInteger(state.pid) || state.pid <= 0 || typeof state.start !== "string") process.exit(1);
console.log(`${state.port} ${state.pid} ${state.start}`);
' "$DEV_WEB_STATE")" || return 1
	read -r DEV_WEB_PORT DEV_WEB_PID DEV_WEB_START <<<"$state"
}

write_state() {
	node -e '
const fs = require("node:fs");
const [file, web, auth, firestore, firestoreWebsocket, hub, logging, emulatorPid, webPid, emulatorStart, webStart, lease, groups] = process.argv.slice(1);
const emulatorGroups = groups.trim().split(/\s+/).filter(Boolean).map(group => { const [pid, start] = group.split("@"); return { pid: +pid, start }; });
fs.writeFileSync(file, JSON.stringify({ web: +web, auth: +auth, firestore: +firestore, firestoreWebsocket: +firestoreWebsocket, hub: +hub, logging: +logging, emulatorPid: +emulatorPid, webPid: +webPid, emulatorStart, webStart, lease, emulatorGroups }));
' "$STATE" "$WEB_PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT" "$EMULATOR_PID" "$WEB_PID" "$EMULATOR_START" "$WEB_START" "$LEASE" "$EMULATOR_GROUPS"
}

capture_emulator_groups() {
	alive "$EMULATOR_PID" "$EMULATOR_START" || return 0
	local pid start changed=0
	while read -r pid; do
		start="$(process_start "$pid" || true)"
		[[ -n "$start" ]] || continue
		if [[ " $EMULATOR_GROUPS " != *" $pid@$start "* ]]; then
			EMULATOR_GROUPS="${EMULATOR_GROUPS:+$EMULATOR_GROUPS }$pid@$start"
			changed=1
		fi
	done < <(ps -eo pid=,ppid=,pgid= | awk -v root="$EMULATOR_PID" '
{ parent[$1]=$2; group[$1]=$3 }
END {
  descendant[root]=1;
  do {
    changed=0;
    for (pid in parent) if (!descendant[pid] && descendant[parent[pid]]) { descendant[pid]=1; changed=1 }
  } while (changed);
  for (pid in parent) if (descendant[pid] && pid != root && group[pid] == pid) print pid;
}')
	if [[ "$changed" == 1 ]]; then write_state; fi
}

running() {
	alive "$EMULATOR_PID" "$EMULATOR_START" || return 1
	local port
	for port in "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"; do
		listening "$port" || return 1
	done
	[[ "$WEB_PID" == 0 ]] || { alive "$WEB_PID" "$WEB_START" && listening "$WEB_PORT"; }
}

require_stack() {
	if ! read_state || ! running; then
		echo 'dev-stack: run `scripts/dev-stack.sh up` first' >&2
		return 1
	fi
}

wait_for() {
	local port="$1" label="$2" pid="$3" start="$4" deadline=$((SECONDS + 120))
	until listening "$port"; do
		capture_emulator_groups
		if ! alive "$pid" "$start" || ((SECONDS >= deadline)); then
			echo "dev-stack: $label did not come up on $port; see $RUN_DIR" >&2
			return 1
		fi
		sleep 1
	done
	capture_emulator_groups
}

wait_http() {
	local url="http://localhost:$WEB_PORT" deadline=$((SECONDS + ${DEV_STACK_WEB_TIMEOUT:-420})) code=""
	until code="$(curl -s -o /dev/null --max-time 10 -w "%{http_code}" "$url" 2>/dev/null)" && [[ "$code" == 200 ]]; do
		if ! alive "$WEB_PID" "$WEB_START" || ((SECONDS >= deadline)); then
			echo "dev-stack: web never answered at $url (last status: ${code:-none})" >&2
			tail -5 "$RUN_DIR/web.log" >&2 2>/dev/null || true
			return 1
		fi
		sleep 2
	done
}

group_alive() {
	ps -eo pgid=,stat= | awk -v group="$1" '$1 == group && $2 !~ /^Z/ { found=1 } END { exit !found }'
}

stop_group() {
	local pid="$1" start="$2" current deadline=$((SECONDS + 15))
	[[ "$pid" -gt 0 ]] || return 0
	current="$(process_start "$pid" || true)"
	if [[ -n "$current" && "$current" != "$start" ]]; then
		echo "dev-stack: pid $pid was reused; leaving it alone" >&2
		return 1
	fi
	kill -TERM -- "-$pid" 2>/dev/null || true
	while group_alive "$pid"; do
		if ((SECONDS >= deadline)); then
			kill -KILL -- "-$pid" 2>/dev/null || true
			sleep 1
			break
		fi
		sleep 1
	done
	if group_alive "$pid"; then
		echo "dev-stack: process group $pid still alive after shutdown" >&2
		return 1
	fi
}

cmd_down() {
	[[ -f "$STATE" ]] || return 0
	read_state
	capture_emulator_groups
	local group port failed=0
	stop_group "$WEB_PID" "$WEB_START" || failed=1
	stop_group "$EMULATOR_PID" "$EMULATOR_START" || failed=1
	for group in $EMULATOR_GROUPS; do
		stop_group "${group%%@*}" "${group#*@}" || failed=1
	done
	for port in "$WEB_PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"; do
		if listening "$port"; then
			echo "dev-stack: port $port still listening after shutdown" >&2
			failed=1
		fi
	done
	[[ "$failed" == 0 ]] || return 1
	ports release "$LEASE" "$WEB_PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"
	rm -f "$STATE"
}

cmd_up() {
	local web=1 port
	for arg in "$@"; do
		case "$arg" in
		--no-web) web=0 ;;
		*)
			echo "dev-stack: unknown option $arg" >&2
			return 2
			;;
		esac
	done
	if read_state && running && { [[ "$web" == 0 ]] || [[ "$WEB_PID" -gt 0 ]]; }; then
		echo "dev-stack: reused"
	else
		cmd_down
		read -r LEASE WEB_PORT AUTH_PORT FIRESTORE_PORT FIRESTORE_WEBSOCKET_PORT HUB_PORT LOGGING_PORT < <(
			ports alloc web auth firestore firestoreWebsocket hub logging | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => { const { lease, ports } = JSON.parse(input); console.log([lease, ...Object.values(ports)].join(" ")); });
'
		)
		EMULATOR_PID=0 WEB_PID=0 EMULATOR_START="" WEB_START="" EMULATOR_GROUPS=""
		write_state
		trap 'cmd_down' ERR
		node -e '
const fs = require("node:fs");
const path = require("node:path");
const [root, web, auth, firestore, firestoreWebsocket, hub, logging] = process.argv.slice(1);
const config = JSON.parse(fs.readFileSync(path.join(root, "firebase.json")));
config.firestore.rules = path.join(root, config.firestore.rules);
config.firestore.indexes = path.join(root, config.firestore.indexes);
config.emulators = { auth: { port: +auth }, firestore: { port: +firestore, websocketPort: +firestoreWebsocket }, hub: { port: +hub }, logging: { port: +logging }, ui: { enabled: false }, singleProjectMode: true };
fs.writeFileSync(path.join(root, ".tmp/dev-stack/firebase.json"), JSON.stringify(config));
' "$ROOT" "$WEB_PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"
		setsid yarn --silent firebase emulators:start --config "$RUN_DIR/firebase.json" \
			--project my-musical-repertoire-dev --only auth,firestore \
			</dev/null >"$RUN_DIR/emulators.log" 2>&1 9>&- &
		EMULATOR_PID=$!
		EMULATOR_START="$(process_start "$EMULATOR_PID")"
		write_state
		ports own "$LEASE" "$EMULATOR_PID" "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"
		if [[ "$web" == 1 ]]; then
			EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_USE_EMULATORS=1 \
				EXPO_PUBLIC_AUTH_EMULATOR_PORT="$AUTH_PORT" EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT="$FIRESTORE_PORT" \
				setsid yarn --silent start --web --port "$WEB_PORT" \
				</dev/null >"$RUN_DIR/web.log" 2>&1 9>&- &
			WEB_PID=$!
			WEB_START="$(process_start "$WEB_PID")"
			write_state
			ports own "$LEASE" "$WEB_PID" "$WEB_PORT"
		else
			ports own "$LEASE" "$EMULATOR_PID" "$WEB_PORT"
		fi
		for port in "$AUTH_PORT" "$FIRESTORE_PORT" "$FIRESTORE_WEBSOCKET_PORT" "$HUB_PORT" "$LOGGING_PORT"; do
			wait_for "$port" emulators "$EMULATOR_PID" "$EMULATOR_START"
		done
		trap - ERR
	fi
	if [[ "$web" == 1 ]]; then
		trap 'cmd_down' ERR
		wait_for "$WEB_PORT" web "$WEB_PID" "$WEB_START"
		wait_http
		trap - ERR
	fi
	echo "SEED_EMAIL=$SEED_EMAIL"
	[[ "$web" == 0 ]] || echo "WEB_URL=http://localhost:$WEB_PORT"
}

cmd_web() {
	local port lease
	mkdir -p "$RUN_DIR"
	read -r lease port < <(ports alloc dev-web | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => { const { lease, ports } = JSON.parse(input); console.log(lease, ports["dev-web"]); });
')
	trap 'ports release "$lease" "$port"' ERR
	ports own "$lease" "$$" "$port"
	node -e '
const fs = require("node:fs");
const [file, port, pid, start, lease] = process.argv.slice(1);
	fs.writeFileSync(file, JSON.stringify({ port: +port, pid: +pid, start, lease }));
' "$DEV_WEB_STATE" "$port" "$$" "$(process_start "$$")" "$lease"
	trap - ERR
	unset EXPO_PUBLIC_USE_EMULATORS EXPO_PUBLIC_AUTH_EMULATOR_PORT EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT
	exec yarn start --web --port "$port"
}

cmd_dev_port() {
	if ! read_dev_web_state || ! alive "$DEV_WEB_PID" "$DEV_WEB_START" || ! listening "$DEV_WEB_PORT"; then
		echo 'dev-stack: run `yarn web` first' >&2
		return 1
	fi
	echo "$DEV_WEB_PORT"
}

case "${1:-up}" in
up | down | status | ports | env)
	mkdir -p "$RUN_DIR"
	exec 9>"$RUN_DIR/lock"
	flock 9
	;;
esac

case "${1:-up}" in
up)
	shift || true
	cmd_up "$@"
	;;
web)
	shift
	[[ $# == 0 ]] || {
		echo "usage: scripts/dev-stack.sh web" >&2
		exit 2
	}
	cmd_web
	;;
dev-port) cmd_dev_port ;;
down) cmd_down ;;
ports)
	require_stack
	[[ "$WEB_PID" -gt 0 ]] || {
		echo 'dev-stack: run `scripts/dev-stack.sh up` first' >&2
		exit 1
	}
	echo "$WEB_PORT"
	;;
env)
	require_stack
	printf 'E2E_WEB_PORT=%s\nAUTH_EMULATOR_PORT=%s\nFIRESTORE_EMULATOR_PORT=%s\nE2E_SEED_EMAIL=%s\n' "$WEB_PORT" "$AUTH_PORT" "$FIRESTORE_PORT" "$SEED_EMAIL"
	;;
fixture) echo "$SEED_EMAIL" ;;
status)
	if read_state; then
		for name in web auth firestore firestoreWebsocket hub logging; do
			case "$name" in
			web)
				port="$WEB_PORT"
				pid="$WEB_PID"
				start="$WEB_START"
				;;
			auth)
				port="$AUTH_PORT"
				pid="$EMULATOR_PID"
				start="$EMULATOR_START"
				;;
			firestore) port="$FIRESTORE_PORT" ;;
			firestoreWebsocket) port="$FIRESTORE_WEBSOCKET_PORT" ;;
			hub) port="$HUB_PORT" ;;
			logging) port="$LOGGING_PORT" ;;
			esac
			live=no
			bound=no
			if alive "$pid" "$start"; then live=yes; fi
			if listening "$port"; then bound=yes; fi
			echo "$name: port=$port pid=$pid alive=$live listening=$bound"
		done
	else
		echo "dev-stack: nothing running"
	fi
	;;
*)
	echo "usage: scripts/dev-stack.sh up [--no-web] | web | down | status | ports | dev-port | env | fixture" >&2
	exit 2
	;;
esac
