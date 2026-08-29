#!/usr/bin/env bash
#
# Boots the stack the e2e suite and the review browser pass run against:
# the Firebase emulator suite plus an Expo web server wired to it.
#
#   scripts/dev-stack.sh up [--no-web] [--fresh]   start what is not already running
#   scripts/dev-stack.sh down                      stop only what this script started
#   scripts/dev-stack.sh status                    what is listening, and whose it is
#   scripts/dev-stack.sh ports                     the e2e web port for this checkout
#   scripts/dev-stack.sh dev-port                  the hand-driven web port
#
#   --no-web   emulators only; for seeding and for anything that never renders
#   --fresh    boot the emulators empty rather than importing .emulator-seed
#
# `up` is idempotent and deliberately asymmetric with `down`: a port already
# listening is left completely alone, and `down` only ever stops what this
# script started. Reusing a stack you did not start is normal — it is your own
# `yarn emulators` in another terminal — but the data in it is whatever that
# session left there, not the committed fixture. `status` says which case you
# are in, and the review stage reports it, because a review run against a
# non-pristine emulator has seen different data than the next one will.
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

# Ownership is per *service*, not per port: one `firebase emulators:start` owns
# all three emulator ports, so asking about 8051 alone would report the suite we
# started as somebody else's.
started_by_us() {
	[[ -f "$RUN_DIR/$1.pid" ]] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null
}

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

start_emulators() {  # $1 = 1 to import .emulator-seed, 0 for a fresh suite
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
	# command, so a lost fixture must not take the stack down with it: it warns
	# and boots empty, which is what makes the regeneration procedure in
	# docs/OPERATIONS.md work at all. `--fresh` is the same empty boot asked for
	# deliberately, and it is how you recover a missing or wrong seed.
	local import=() origin="empty (--fresh)"
	if [[ "$1" == 1 ]]; then
		if [[ -d "$SEED_DIR" ]]; then
			import=(--import "$SEED_DIR")
			origin="pristine from $SEED_DIR"
		else
			origin="empty (no $SEED_DIR)"
			echo "dev-stack: no $SEED_DIR — starting empty; the suite will be wrong until you regenerate it with 'yarn fixture' and 'yarn emulators:export'" >&2
		fi
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
	# stdin from /dev/null, not CI=1, to keep Expo non-interactive. CI=1 also
	# turns Metro's file watcher off, and a watcher-less server keeps serving
	# the code it started with: you edit a component, re-run e2e, and the app
	# under test is the old one, so a test can pass against a change that was
	# never there. GitHub Actions sets CI itself, which is where freezing the
	# bundle for the length of a run is the right behaviour.
	EXPO_NO_TELEMETRY=1 EXPO_PUBLIC_USE_EMULATORS=1 \
		setsid yarn --silent expo start --web --port "$WEB_PORT" \
		</dev/null >"$RUN_DIR/web.log" 2>&1 &
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

cmd_up() {
	local web=1 import=1
	for arg in "$@"; do
		case "$arg" in
		--no-web) web=0 ;;
		--fresh) import=0 ;;
		*)
			echo "dev-stack: unknown option $arg" >&2
			exit 2
			;;
		esac
	done
	mkdir -p "$RUN_DIR"
	start_emulators "$import"
	[[ "$web" == 1 ]] || return 0
	start_web
	echo "WEB_URL=http://localhost:$WEB_PORT"
}

cmd_status() {
	local emu_owner="external" web_owner="external" any=0
	started_by_us emulators && emu_owner="ours"
	started_by_us web && web_owner="ours"

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
}

case "${1:-up}" in
up)
	shift || true
	cmd_up "$@"
	;;
down)
	stop_one web "$WEB_PORT"
	stop_one emulators "$FIRESTORE_PORT"
	;;
status)
	cmd_status
	;;
ports)
	echo "$WEB_PORT"
	;;
dev-port)
	# The hand-driven server (`yarn web`), which talks to the real dev project.
	echo "$DEV_PORT"
	;;
*)
	echo "usage: scripts/dev-stack.sh up [--no-web] [--fresh] | down | status | ports | dev-port" >&2
	exit 2
	;;
esac
