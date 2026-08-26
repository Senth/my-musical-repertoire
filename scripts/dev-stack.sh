#!/usr/bin/env bash
#
# Boots the stack the e2e suite and the review browser pass run against:
# the Firebase emulator suite plus an Expo web server wired to it.
#
#   scripts/dev-stack.sh up     start what is not already running
#   scripts/dev-stack.sh down   stop only what this script started
#   scripts/dev-stack.sh ports  print the e2e web port for this checkout
#   scripts/dev-stack.sh dev-port  print the hand-driven web port
#
# Deliberately separate from the dev server you run by hand on 8053/8054:
# that one talks to the real dev Firebase project and must keep doing so.
# See docs/OPERATIONS.md.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# Emulator ports come from firebase.json, which has no env interpolation, so
# every checkout shares one suite. Two checkouts running e2e at once share
# throwaway data — which is what a seeded fixture is for.
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

RUN_DIR="$ROOT/.tmp/dev-stack"
SEED_DIR="$ROOT/.emulator-seed"

listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

wait_for() {  # port, label, seconds
	local port="$1" label="$2" deadline=$((SECONDS + ${3:-90}))
	until listening "$port"; do
		if ((SECONDS >= deadline)); then
			echo "dev-stack: $label did not come up on $port" >&2
			return 1
		fi
		sleep 1
	done
}

start_emulators() {
	# Both, not either. A suite half up — auth dead, Firestore alive — reads as
	# reusable and then fails every sign-in with ERR_CONNECTION_REFUSED, which
	# surfaces as a test that hangs on a form rather than as an infra error.
	if listening "$FIRESTORE_PORT" && listening "$AUTH_PORT"; then
		echo "emulators: reused (already listening) — data is whatever the last run left"
		return
	fi
	if listening "$FIRESTORE_PORT" || listening "$AUTH_PORT"; then
		echo "dev-stack: emulator suite is half up; run 'scripts/dev-stack.sh down' first" >&2
		exit 1
	fi
	# `--import` refuses to create a missing directory and fails the whole
	# command, so a lost fixture must not take the stack down with it.
	local import=() origin="empty (no $SEED_DIR)"
	if [[ -d "$SEED_DIR" ]]; then
		import=(--import "$SEED_DIR")
		origin="pristine from $SEED_DIR"
	else
		echo "emulators: no $SEED_DIR — starting empty; regenerate with 'yarn emulators:export'" >&2
	fi
	setsid yarn --silent firebase emulators:start "${import[@]}" \
		>"$RUN_DIR/emulators.log" 2>&1 &
	echo $! >"$RUN_DIR/emulators.pid"
	wait_for "$FIRESTORE_PORT" "firestore emulator" 120
	wait_for "$AUTH_PORT" "auth emulator" 30
	echo "emulators: started, $origin (ui on $UI_PORT)"
}

start_web() {
	if listening "$WEB_PORT"; then
		echo "web: reused (already listening on $WEB_PORT)"
		return
	fi
	CI=1 EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_USE_EMULATORS=1 \
		setsid yarn --silent expo start --web --port "$WEB_PORT" \
		>"$RUN_DIR/web.log" 2>&1 &
	echo $! >"$RUN_DIR/web.pid"
	wait_for "$WEB_PORT" "expo web server" 180
	echo "web: started on http://localhost:$WEB_PORT (emulator-backed)"
}

# `setsid` puts each service in its own process group, so one signal takes the
# whole tree down. Signalling the yarn wrapper alone leaves the node process it
# spawned holding the port, which then reads as "reused" on the next `up`.
stop_one() {  # name, port to wait on
	local pidfile="$RUN_DIR/$1.pid"
	[[ -f "$pidfile" ]] || return 0
	local pid pgid
	pid="$(cat "$pidfile")"
	pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ')"
	rm -f "$pidfile"
	[[ -n "$pgid" ]] || return 0

	kill -TERM -- "-$pgid" 2>/dev/null || true
	# The Firestore emulator is a JVM and does not always go on the first
	# TERM. Leaving it holding the port is worse than being blunt: the next
	# `up` sees a half-up suite and refuses to start.
	local deadline=$((SECONDS + 15))
	while listening "$2" && ((SECONDS < deadline)); do sleep 1; done
	if listening "$2"; then
		kill -KILL -- "-$pgid" 2>/dev/null || true
		sleep 1
	fi
	echo "$1: stopped"
}

case "${1:-up}" in
up)
	mkdir -p "$RUN_DIR"
	start_emulators
	start_web
	echo "WEB_URL=http://localhost:$WEB_PORT"
	;;
down)
	stop_one web "$WEB_PORT"
	stop_one emulators "$FIRESTORE_PORT"
	;;
ports)
	echo "$WEB_PORT"
	;;
dev-port)
	# The hand-driven server (`yarn web`), which talks to the real dev project.
	echo "$DEV_PORT"
	;;
*)
	echo "usage: scripts/dev-stack.sh [up|down|ports|dev-port]" >&2
	exit 2
	;;
esac
