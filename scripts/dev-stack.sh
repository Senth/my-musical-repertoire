#!/usr/bin/env bash
#
# Boots the stack the e2e suite and the review browser pass run against:
# the Firebase emulator suite plus an Expo web server wired to it.
#
#   scripts/dev-stack.sh up [--no-web]   start what is not already running
#   scripts/dev-stack.sh down            release this checkout; stop the last shared stack
#   scripts/dev-stack.sh status          what is listening, and whose it is
#   scripts/dev-stack.sh ports           the e2e web port for this checkout
#   scripts/dev-stack.sh fixture         this checkout's e2e fixture email
#   scripts/dev-stack.sh dev-port        the hand-driven web port
#
#   --no-web   emulators only; for anything that never renders
#
# The emulators always boot empty: the fixture is written programmatically by
# the e2e suite's own seed project (`e2e/seed.setup.ts`) at the start of every
# `yarn e2e`, so there is no committed export to import and no `--fresh` to ask
# for. The first `yarn e2e` after a cold `up` is what populates the account.
#
# `up` returns only once the web URL actually answers an HTTP request — the
# port binding well before the first bundle is compiled is exactly how a CI
# runner loses its whole suite to a 30s navigation timeout. The first bundle
# on a cold runner takes minutes, so the poll allows minutes; a stack that is
# already serving returns immediately. `DEV_STACK_WEB_TIMEOUT` overrides the
# deadline in seconds.
#
#
# The web server is the exception to reuse. Every worktree shares 8056, and a
# server another checkout started serves *that* checkout's code, so a suite run
# against it passes or fails on someone else's diff. `up` refuses it instead;
# `E2E_WEB_PORT` moves this checkout's stack (and `yarn e2e`) to a free port.
#
# Deliberately separate from the dev server you run by hand on 8053/8054:
# that one talks to the real dev Firebase project and must keep doing so.
# See docs/OPERATIONS.md.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
CHECKOUT_ID="$(printf '%s' "$ROOT" | sha256sum | cut -c1-6)"
SEED_EMAIL="pianist-$CHECKOUT_ID@example.com"

# Emulator ports come from firebase.json, which has no env interpolation, so
# every checkout shares one suite. Each checkout's seeded fixture account is
# separate, even when two checkouts run e2e at once.
UI_PORT=8050
AUTH_PORT=8051
FIRESTORE_PORT=8052

# This project owns 8050-8056 outright; the sibling home-backlog owns 8060-8064
# and 8081, so neither repo's stack can take a port the other is using.
# The web server is per-checkout, mirroring the 8053/8054 rule for the servers
# you start by hand.
if [[ "$(basename "$ROOT")" == "my-musical-repertoire" ]]; then
	WEB_PORT=8055
	DEV_PORT=8053
else
	WEB_PORT=8056
	DEV_PORT=8054
fi
WEB_PORT="${E2E_WEB_PORT:-$WEB_PORT}"
# Keyed by port: a live pid recorded for 8057 says nothing about who serves 8056.
WEB="web-$WEB_PORT"

RUN_DIR="$ROOT/.tmp/dev-stack"
STACK_DIR="$HOME/.cache/my-musical-repertoire/dev-stack"
LEASE_DIR="$STACK_DIR/leases"

listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

# Ownership is per *service*, not per port: one `firebase emulators:start` owns
# all three emulator ports, so asking about 8051 alone would report the suite we
# started as somebody else's.
started_by_us() {
	[[ -f "$RUN_DIR/$1.pid" ]] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null
}

wait_for() { # port, label, seconds
	local port="$1" label="$2" deadline=$((SECONDS + ${3:-90}))
	until listening "$port"; do
		if ((SECONDS >= deadline)); then
			echo "dev-stack: $label did not come up on $port" >&2
			return 1
		fi
		sleep 1
	done
}

wait_http() { # url, label, seconds
	local url="$1" label="$2" deadline=$((SECONDS + ${3:-${DEV_STACK_WEB_TIMEOUT:-420}}))
	local tries=0 code=""
	# The port binding is not the same as the server answering: Expo binds and
	# only then compiles the bundle, and that first compile is the slow part.
	# A request that times out is a still-compiling server, not a dead one.
	until code="$(curl -s -o /dev/null --max-time 10 -w "%{http_code}" "$url" 2>/dev/null)" && [[ "$code" == "200" ]]; do
		if ((SECONDS >= deadline)); then
			echo "dev-stack: $label never answered at $url (last status: ${code:-none})" >&2
			echo "dev-stack: last lines of the web log:" >&2
			tail -5 "$RUN_DIR/$WEB.log" >&2 2>/dev/null || true
			return 1
		fi
		if ((tries % 8 == 7)); then
			echo "dev-stack: still waiting for $url to answer (last status: ${code:-none}, ${SECONDS}s elapsed)..."
		fi
		tries=$((tries + 1))
		sleep 2
	done
}

start_emulators() {
	# Both, not either. A suite half up — auth dead, Firestore alive — reads as
	# reusable and then fails every sign-in with ERR_CONNECTION_REFUSED, which
	# surfaces as a test that hangs on a form rather than as an infra error.
	if listening "$FIRESTORE_PORT" && listening "$AUTH_PORT"; then
		echo "emulators: reused (already listening) — the fixture account is rewritten by every yarn e2e"
		return
	fi
	if listening "$FIRESTORE_PORT" || listening "$AUTH_PORT"; then
		echo "dev-stack: emulator suite is half up; run 'scripts/dev-stack.sh down' first" >&2
		exit 1
	fi
	setsid yarn --silent firebase emulators:start \
		>"$RUN_DIR/emulators.log" 2>&1 9>&- &
	echo $! >"$RUN_DIR/emulators.pid"
	wait_for "$FIRESTORE_PORT" "firestore emulator" 120
	wait_for "$AUTH_PORT" "auth emulator" 30
	echo "emulators: started, empty (the e2e seed project populates it) (ui on $UI_PORT)"
}

start_web() {
	if listening "$WEB_PORT" && ! started_by_us "$WEB"; then
		echo "dev-stack: $WEB_PORT is served by a web server this checkout did not start," >&2
		echo "  so it would test another checkout's code. Stop it, or rerun with" >&2
		echo "  E2E_WEB_PORT=<free port> for both 'scripts/dev-stack.sh up' and 'yarn e2e'." >&2
		exit 1
	fi
	if listening "$WEB_PORT"; then
		echo "web: reused (already listening on $WEB_PORT)"
		wait_http "http://localhost:$WEB_PORT" "reused web server" "${DEV_STACK_WEB_TIMEOUT:-420}"
		echo "web: serving on http://localhost:$WEB_PORT (emulator-backed)"
		return
	fi
	# stdin from /dev/null, not CI=1, to keep Expo non-interactive. CI=1 also
	# turns Metro's file watcher off, and a watcher-less server keeps serving
	# the code it started with: you edit a component, re-run e2e, and the app
	# under test is the old one, so a test can pass against a change that was
	# never there. GitHub Actions sets CI itself, which is where freezing the
	# bundle for the length of a run is the right behaviour.
	# `yarn start` carries --stack-size: React's dev server render recurses ~1,260
	# frames deep through the router's providers on /piece/add, past Node's
	# default ~1MB stack while cold ("Invalid regular expression: ... Stack
	# overflow"). 4000KB fits the 8MB main-thread stack.
	EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_USE_EMULATORS=1 \
		setsid yarn --silent start --web --port "$WEB_PORT" \
		</dev/null >"$RUN_DIR/$WEB.log" 2>&1 9>&- &
	echo $! >"$RUN_DIR/$WEB.pid"
	wait_for "$WEB_PORT" "expo web server" 180
	wait_http "http://localhost:$WEB_PORT" "expo web server (first bundle)" "${DEV_STACK_WEB_TIMEOUT:-420}"
	echo "web: started on http://localhost:$WEB_PORT (emulator-backed)"
}

# `setsid` puts each service in its own process group, so one signal takes the
# whole tree down. Signalling the yarn wrapper alone leaves the node process it
# spawned holding the port, which then reads as "reused" on the next `up`.
stop_one() { # name, port to wait on
	local pidfile="$RUN_DIR/$1.pid"
	[[ -f "$pidfile" ]] || return 0
	local pid pgid
	pid="$(cat "$pidfile")"
	pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
	rm -f "$pidfile"
	[[ -n "$pgid" ]] || return 0
	stop_groups "$1" "$2" "-$pgid"
}

stop_groups() {
	local name="$1" port="$2"
	shift 2
	kill -TERM -- "$@" 2>/dev/null || true
	# The Firestore emulator is a JVM and does not always go on the first
	# TERM. Leaving it holding the port is worse than being blunt: the next
	# `up` sees a half-up suite and refuses to start.
	local deadline=$((SECONDS + 15))
	while listening "$port" && ((SECONDS < deadline)); do sleep 1; done
	if listening "$port"; then
		kill -KILL -- "$@" 2>/dev/null || true
		sleep 1
	fi
	echo "$name: stopped"
}

firebase_launcher() {
	local command
	command="$(ps -o args= -p "$1" || true)"
	[[ "$command" =~ ^([^[:space:]]*/)?(node(js)?[[:space:]]+)?([^[:space:]]*/)?(firebase(\.js)?|yarn(\.js)?([[:space:]]+--silent)?[[:space:]]+firebase)[[:space:]]+emulators:start([[:space:]]|$) ]]
}

stop_emulators() {
	local pid pgid listener port
	for port in "$FIRESTORE_PORT" "$AUTH_PORT" "$UI_PORT"; do
		pid="$(lsof -t -iTCP:"$port" -sTCP:LISTEN || true)"
		[[ -z "$pid" ]] || break
	done
	[[ -n "$pid" ]] || return 0
	listener="$pid"
	while [[ "$pid" -gt 1 ]]; do
		if firebase_launcher "$pid"; then
			pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
			if ! firebase_launcher "$pgid"; then
				echo "dev-stack: refusing to stop shared emulator process group $pgid" >&2
				return 1
			fi
			stop_groups emulators "$port" "-$pgid" "$listener"
			rm -f "$RUN_DIR/emulators.pid"
			return
		fi
		pid="$(ps -o ppid= -p "$pid" | tr -d ' ' || true)"
	done
	echo "dev-stack: refusing to stop $port; no firebase emulators:start ancestor" >&2
	return 1
}

process_start() {
	local stat
	local -a fields
	stat="$(cat "/proc/$1/stat" 2>/dev/null)" || return 1
	read -r -a fields <<<"${stat##*) }"
	[[ "${fields[0]}" != Z ]] || return 1
	printf '%s:%s\n' "$(cat /proc/sys/kernel/random/boot_id)" "${fields[19]}"
}

live_leases() {
	local lease checkout pid start current
	for lease in "$LEASE_DIR"/*; do
		[[ -f "$lease" ]] || continue
		{
			IFS= read -r checkout
			IFS= read -r pid
			IFS= read -r start || true
		} <"$lease"
		if [[ -n "$pid" ]] && { ! current="$(process_start "$pid")" || [[ "$start" != "$current" ]]; }; then
			rm -f "$lease"
		else
			printf '  %s (web pid: %s)\n' "$checkout" "${pid:-none}"
		fi
	done
}

cmd_down() {
	stop_one "$WEB" "$WEB_PORT"
	rm -f "$LEASE_DIR/$CHECKOUT_ID"
	local holders
	holders="$(live_leases)"
	if [[ -n "$holders" ]]; then
		printf 'emulators: kept for checkouts:\n%s\n' "$holders"
	else
		stop_emulators
	fi
}

cmd_up() {
	local web=1 pid="" start=""
	for arg in "$@"; do
		case "$arg" in
		--no-web) web=0 ;;
		*)
			echo "dev-stack: unknown option $arg" >&2
			exit 2
			;;
		esac
	done
	mkdir -p "$RUN_DIR" "$LEASE_DIR"
	start_emulators
	if [[ "$web" == 1 ]]; then
		start_web
		pid="$(lsof -t -iTCP:"$WEB_PORT" -sTCP:LISTEN)"
		start="$(process_start "$pid")"
	fi
	printf '%s\n%s\n%s\n' "$ROOT" "$pid" "$start" >"$LEASE_DIR/$CHECKOUT_ID"
	echo "SEED_EMAIL=$SEED_EMAIL"
	[[ "$web" == 1 ]] || return 0
	echo "WEB_URL=http://localhost:$WEB_PORT"
}

cmd_status() {
	local emu_owner="external" web_owner="external" any=0
	started_by_us emulators && emu_owner="ours"
	started_by_us "$WEB" && web_owner="ours"

	for port in "$UI_PORT" "$AUTH_PORT" "$FIRESTORE_PORT"; do
		if listening "$port"; then
			any=1
			echo "  $port  listening  ($emu_owner)  emulators"
		else
			echo "  $port  free"
		fi
	done
	if listening "$WEB_PORT"; then
		any=1
		echo "  $WEB_PORT  listening  ($web_owner)  web"
	else
		echo "  $WEB_PORT  free"
	fi
	[[ "$any" == 1 ]] || echo "dev-stack: nothing running"
	echo "leases:"
	live_leases
}

case "${1:-up}" in
up | down | status)
	mkdir -p "$LEASE_DIR"
	exec 9>"$STACK_DIR/lock"
	flock 9
	;;
esac

case "${1:-up}" in
up)
	shift || true
	cmd_up "$@"
	;;
down)
	cmd_down
	;;
status)
	cmd_status
	;;
ports)
	echo "$WEB_PORT"
	;;
fixture)
	echo "$SEED_EMAIL"
	;;
dev-port)
	# The hand-driven server (`yarn web`), which talks to the real dev project.
	echo "$DEV_PORT"
	;;
*)
	echo "usage: scripts/dev-stack.sh up [--no-web] | down | status | ports | fixture | dev-port" >&2
	exit 2
	;;
esac
