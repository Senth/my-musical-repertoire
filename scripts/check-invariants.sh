#!/usr/bin/env bash
#
# The rules CLAUDE.md states that no linter enforces.
#
# Every check here is greppable by definition — a rule that needs reading
# belongs to diff-review, not to this script. When a check produces a false
# positive, append `// invariants:allow` to the offending line rather than
# widening the pattern; a widened pattern stops catching the real thing.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)"

SRC=(app components hooks contexts utils models config i18n)
fails=0

report() {  # name, result, detail
	if [[ "$2" == PASS ]]; then
		printf '  %-34s PASS\n' "$1"
	else
		printf '  %-34s FAIL\n' "$1"
		printf '%s\n' "$3" | sed 's/^/      /'
		fails=$((fails + 1))
	fi
}

drop_allowed() { grep -v 'invariants:allow' || true; }

echo "invariants"

# ---------------------------------------------------------------- styling ---
# Paper component, else a NativeWind class. A StyleSheet is neither.
hits="$(grep -rn "StyleSheet.create" "${SRC[@]}" 2>/dev/null | drop_allowed)"
[[ -z "$hits" ]] && report "no StyleSheet.create" PASS \
	|| report "no StyleSheet.create" FAIL "$hits"

# ---------------------------------------------------------------- imports ---
# `./sibling` is fine; reaching up a directory is what the @/ alias is for.
hits="$(grep -rn 'from "\.\./' "${SRC[@]}" 2>/dev/null | drop_allowed)"
[[ -z "$hits" ]] && report "@/ alias, no ../ imports" PASS \
	|| report "@/ alias, no ../ imports" FAIL "$hits"

# ------------------------------------------------------------------- t() ---
# A literal in one of these props is a string that ships untranslated. The
# pattern cannot tell a user-facing string from a testID, so it only looks at
# the four props that are always user-facing.
hits="$(grep -rEn '(^|[[:space:]])(label|title|placeholder|accessibilityLabel)="[A-Za-z][^"]{2,}"' \
	app components 2>/dev/null | drop_allowed)"
[[ -z "$hits" ]] && report "user-facing strings via t()" PASS \
	|| report "user-facing strings via t()" FAIL "$hits"

# -------------------------------------------------------------- deletion ---
# Account deletion is a promise in the privacy policy, not a feature. A
# collection or a device key that nothing deletes makes that promise false.
missing=""
while read -r name; do
	[[ -z "$name" || "$name" == "users" ]] && continue
	grep -q "\"$name\"" utils/delete-account.ts \
		|| missing+="collection \"$name\" is never deleted by utils/delete-account.ts"$'\n'
done < <(grep -rhoE 'collection\([^,]+, *"[a-zA-Z]+"' "${SRC[@]}" 2>/dev/null \
	| sed 's/.*"\(.*\)"/\1/' | sort -u)

clear_body="$(sed -n '/export async function clearLocalUserData/,/^}/p' utils/session-storage.ts)"
while read -r fn; do
	[[ -z "$fn" ]] && continue
	grep -q "$fn(uid)" <<<"$clear_body" \
		|| missing+="$fn is never cleared by clearLocalUserData"$'\n'
done < <(grep -oE '^function [a-zA-Z]+Key\(' utils/session-storage.ts \
	| sed 's/^function //; s/($//; s/(//')

[[ -z "$missing" ]] && report "deletion covers every store" PASS \
	|| report "deletion covers every store" FAIL "${missing%$'\n'}"

# ------------------------------------------------------- acceptance claims ---
# A `[test]` claim that never became a test is a claim nobody checks. The
# mapping is deliberately literal: the e2e test title *is* the claim text.
missing=""
shopt -s nullglob
for spec in docs/specs/wip/*.md; do
	while read -r claim; do
		[[ -z "$claim" ]] && continue
		grep -rqF "$claim" e2e 2>/dev/null \
			|| missing+="$spec: no e2e test titled \"$claim\""$'\n'
	done < <(awk '
		/^[0-9]+\. *\[test\]/ { if (c) print c; c = $0; next }
		/^[[:space:]]+[^ ]/   { if (c) c = c " " $0; next }
		{ if (c) print c; c = "" }
		END { if (c) print c }
	' "$spec" | sed -E 's/^[0-9]+\. *\[test\] *//; s/[[:space:]]+/ /g; s/ *\.? *$//')
done
shopt -u nullglob

[[ -z "$missing" ]] && report "[test] claims have e2e tests" PASS \
	|| report "[test] claims have e2e tests" FAIL "${missing%$'\n'}"

echo
if ((fails)); then
	echo "invariants: $fails FAILED"
	exit 1
fi
echo "invariants: all PASS"
