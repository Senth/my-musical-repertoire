#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
SCRIPT="$ROOT/scripts/dev-stack.sh"
TEST_DIR="$(mktemp -d "$ROOT/.tmp/dev-stack-test.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
export HOME="$TEST_DIR"
source <(sed '/^case "${1:-up}" in/,$d' "$SCRIPT")
RUN_DIR="$TEST_DIR/run"
ROOT="$TEST_DIR/checkout with spaces"

start_emulators() { :; }
start_web() { :; }
lsof() { echo "$$"; }
stop_one() { echo "web stopped" >>"$TEST_DIR/events"; }
stop_emulators() { echo "emulators stopped" >>"$TEST_DIR/events"; }
listening() { return 1; }

cmd_up >/dev/null
[[ -f "$LEASE_DIR/$CHECKOUT_ID" ]]
[[ "$(head -1 "$LEASE_DIR/$CHECKOUT_ID")" == "$ROOT" ]]
[[ "$(tail -1 "$LEASE_DIR/$CHECKOUT_ID")" == "$$" ]]

printf '%s\n%s\n' "$TEST_DIR/sibling" "$$" >"$LEASE_DIR/sibling"
cmd_down >"$TEST_DIR/output"
[[ ! -f "$LEASE_DIR/$CHECKOUT_ID" ]]
grep -q "$TEST_DIR/sibling" "$TEST_DIR/output"
! grep -q 'emulators stopped' "$TEST_DIR/events"

rm "$LEASE_DIR/sibling"
cmd_up --no-web >/dev/null
[[ -z "$(tail -1 "$LEASE_DIR/$CHECKOUT_ID")" ]]
printf '%s\n\n' "$TEST_DIR/headless sibling" >"$LEASE_DIR/headless"
printf '%s\n%s\n' "$TEST_DIR/dead sibling" 2147483647 >"$LEASE_DIR/dead"
cmd_status >"$TEST_DIR/output"
grep -q "$TEST_DIR/headless sibling" "$TEST_DIR/output"
[[ ! -f "$LEASE_DIR/dead" ]]
cmd_down >/dev/null
[[ -f "$LEASE_DIR/headless" ]]
! grep -q 'emulators stopped' "$TEST_DIR/events"

rm "$LEASE_DIR/headless"
printf '%s\n%s\n' "$TEST_DIR/dead sibling" 2147483647 >"$LEASE_DIR/dead"
cmd_down >/dev/null
[[ ! -f "$LEASE_DIR/dead" ]]
[[ "$(tail -1 "$TEST_DIR/events")" == 'emulators stopped' ]]

(
	source <(sed '/^case "${1:-up}" in/,$d' "$SCRIPT")
	RUN_DIR="$TEST_DIR/run"
	lsof() { echo 7001; }
	ps() {
		case "$2:$4" in
		pgid=:7001) echo 7001 ;;
		args=:7001) echo java ;;
		ppid=:7001) echo 7000 ;;
		args=:7000) echo 'node /fixture/node_modules/.bin/firebase emulators:start' ;;
		pgid=:7000) echo 7000 ;;
		*) return 1 ;;
		esac
	}
	kill() { echo "$*" >>"$TEST_DIR/signals"; }
	stop_emulators >/dev/null
	grep -q -- '-TERM -- -7000 -7001' "$TEST_DIR/signals"
	rm "$TEST_DIR/signals"
	ps() {
		case "$2" in
		pgid=) echo 7001 ;;
		args=) echo 'unrelated server' ;;
		ppid=) echo 1 ;;
		esac
	}
	if stop_emulators >"$TEST_DIR/output" 2>&1; then exit 1; fi
	grep -q 'no firebase emulators:start ancestor' "$TEST_DIR/output"
	[[ ! -f "$TEST_DIR/signals" ]]
)

echo "dev-stack lease lifecycle: pass"
