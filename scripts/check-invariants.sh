#!/usr/bin/env bash
#
# The grep-shaped half of the CLAUDE.md invariants, run deterministically.
#
# Every check here is greppable by definition — a rule that needs reading
# belongs to diff-review, not to this script. When a check produces a false
# positive, append `// invariants:allow` to the offending line rather than
# widening the pattern; a widened pattern stops catching the real thing.
#
# Usage:   yarn invariants [--base <ref>]
# Exit:    0 = all pass, 1 = an invariant failed, 2 = the script could not run
#
# Checks 1-6 read the whole working tree — tracked files *and* untracked ones
# that git would add, because the moment you most want this run is right after
# writing a new file, and a new file has not been staged yet.
#
# Check 7 is diff-shaped and needs a base ref. Auto-detected, it reports `skip`
# when there is nothing to diff against; named explicitly with `--base` and
# unresolvable, it is a hard error — a CI expression that evaluates to an empty
# string must never read as a pass.
#
# Not here yet, deliberately:
#   * style literals and colour literals — the app is still on NativeWind, and
#     both checks turn on green in the PR that moves it to theme/tokens.ts.
#   * domain modules have a sibling test — see #125. Eleven modules have none,
#     and a gate turns on green inside the PR that earns it, never behind a
#     baseline file.
#
# Requires: git, grep, jq, and bash 4.4+ for `mapfile -d`.
set -uo pipefail

# `sort` orders by codepoint and `comm` compares by LC_COLLATE; keeping the
# whole script under one locale keeps every comparison agreeing with itself.
export LC_ALL=C

top=$(git rev-parse --show-toplevel 2>/dev/null) || {
	echo "check-invariants: not inside a git repository" >&2; exit 2; }
cd "$top" || { echo "check-invariants: cannot enter $top" >&2; exit 2; }

BASE=""
BASE_EXPLICIT=0
while [[ $# -gt 0 ]]; do
	case "$1" in
		--base)
			[[ $# -ge 2 ]] || { echo "check-invariants: --base needs a ref" >&2; exit 2; }
			BASE="$2"; BASE_EXPLICIT=1; shift 2 ;;
		-h|--help) sed -n '3,29p' "$0" | sed 's/^# \?//'; exit 0 ;;
		*) echo "check-invariants: unknown argument: $1" >&2; exit 2 ;;
	esac
done

# ---------------------------------------------------------------------------
# What is in scope
#
# `--others --exclude-standard` is what makes a brand-new file visible while
# still honouring .gitignore. `e2e/` and the Playwright configs are app-adjacent
# but not app code: a viewport of 390x844 is the number under test, not a value
# the app should be reading from somewhere.
# ---------------------------------------------------------------------------
mapfile -t -d '' TREE < <(
	git ls-files -z --cached --others --exclude-standard '*.ts' '*.tsx')

SRC=()      # app code
ALL_TS=()   # every TypeScript file the alias rule applies to
for f in "${TREE[@]}"; do
	[[ "$f" =~ ^(dist|node_modules)/ ]] && continue
	ALL_TS+=("$f")
	[[ "$f" =~ ^(scripts|e2e)/ ]] && continue
	[[ "$f" == playwright*.config.ts ]] && continue
	SRC+=("$f")
done

if [[ ${#ALL_TS[@]} -eq 0 ]]; then
	echo "check-invariants: no TypeScript sources found — refusing to report a pass" >&2
	exit 2
fi

FAILED=0
declare -a RESULTS

# `-H` because a batch of exactly one file makes grep drop the path prefix, and
# every consumer below parses `path:line:text`. `-r` because an empty list must
# not leave grep reading stdin.
scan() {
	# No files is a pass, and it must not reach xargs: `printf '%s\0'` with no
	# arguments emits one NUL, which `xargs -0` reads as one empty filename.
	[[ $# -gt 0 ]] || return 0
	printf '%s\0' "$@" | xargs -0 -r grep -HnE "$PATTERN"
}

# A trailing `// invariants:allow` silences one line. Never widen a pattern to
# do the same job — a widened pattern stops catching the real thing.
drop_allowed() { grep -v 'invariants:allow' || true; }

# Drop lines that are wholly a comment: an issue reference like `#101` and a
# worked example are not violations. The comment marker is what follows the
# second colon of `path:line:text`.
strip_comments() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' || true; }

# report <number> <name> <status> [detail-blocks...]
report() {
	local num="$1" name="$2" status="$3"; shift 3
	RESULTS+=("$(printf '%2s|%s|%s' "$num" "$name" "$status")")
	if [[ "$status" == "FAIL" ]]; then
		FAILED=1
		printf '\n\033[31m%s. %s\033[0m\n' "$num" "$name" >&2
		printf '%s\n' "$@" | sed 's/^/    /' >&2
	fi
}

# ---------------------------------------------------------------------------
# 1. Imports use the @/ alias, never a parent directory
#
# `./sibling` is fine and deliberately allowed — reaching *up* a directory is
# what the alias is for, and that is the rule CLAUDE.md states.
# ---------------------------------------------------------------------------
PATTERN='(from|import|require\()[[:space:]]*\(?["'\''`]\.\./'
hits=$(scan "${ALL_TS[@]}" | drop_allowed | strip_comments)
if [[ -n "$hits" ]]; then
	report 1 "@/ alias, no ../ imports" FAIL "$hits" \
		"Rewrite as @/<path-from-repo-root>."
else
	report 1 "@/ alias, no ../ imports" ok
fi

# ---------------------------------------------------------------------------
# 2. No StyleSheet.create
#
# The styling order is a Paper component first, else a NativeWind class, and
# only then a style prop. A StyleSheet is none of the three. When the app moves
# onto theme/tokens.ts this check widens to cover Tailwind and NativeWind too.
# ---------------------------------------------------------------------------
PATTERN='StyleSheet\.create|styled-components'
hits=$(scan "${ALL_TS[@]}" | drop_allowed | strip_comments)
if [[ -n "$hits" ]]; then
	report 2 "no StyleSheet.create" FAIL "$hits" \
		"Use a react-native-paper component, else a NativeWind class."
else
	report 2 "no StyleSheet.create" ok
fi

# ---------------------------------------------------------------------------
# 3. User-facing strings go through t()
#
# A literal in one of these props is a string that ships untranslated. The
# pattern cannot tell a user-facing string from a testID, so it only looks at
# the four props that are always user-facing. The wider rule — a literal held
# in a variable, or built by interpolation — needs reading, and belongs to
# diff-review.
# ---------------------------------------------------------------------------
PATTERN='(^|[[:space:]])(label|title|placeholder|accessibilityLabel)="[A-Za-z][^"]{2,}"'
hits=$(scan app components 2>/dev/null | drop_allowed | strip_comments)
if [[ -n "$hits" ]]; then
	report 3 "user-facing strings via t()" FAIL "$hits" \
		"Wrap it in t() and add the key to i18n/locales/en-US.json in the same change."
else
	report 3 "user-facing strings via t()" ok
fi

# ---------------------------------------------------------------------------
# 4. Account deletion walks every store
#
# Account deletion is a promise in the privacy policy, not a feature. A
# collection or a device key that nothing deletes makes that promise false.
# Whether the *walk order* is right — children before parents — is judgement,
# and belongs to diff-review.
# ---------------------------------------------------------------------------
missing=""
while read -r name; do
	[[ -z "$name" || "$name" == "users" ]] && continue
	grep -q "\"$name\"" utils/delete-account.ts \
		|| missing+="collection \"$name\" is never deleted by utils/delete-account.ts"$'\n'
done < <(printf '%s\0' "${SRC[@]}" \
	| xargs -0 -r grep -hoE 'collection\([^,]+, *"[a-zA-Z]+"' 2>/dev/null \
	| sed 's/.*"\(.*\)"/\1/' | sort -u)

clear_body="$(sed -n '/export async function clearLocalUserData/,/^}/p' utils/session-storage.ts)"
while read -r fn; do
	[[ -z "$fn" ]] && continue
	grep -q "$fn(uid)" <<<"$clear_body" \
		|| missing+="$fn is never cleared by clearLocalUserData"$'\n'
done < <(grep -oE '^function [a-zA-Z]+Key\(' utils/session-storage.ts \
	| sed 's/^function //; s/(//')

if [[ -n "$missing" ]]; then
	report 4 "deletion covers every store" FAIL "${missing%$'\n'}" \
		"Add it to utils/delete-account.ts and to clearLocalUserData, children before parents."
else
	report 4 "deletion covers every store" ok
fi

# ---------------------------------------------------------------------------
# 5. Every [test] acceptance claim has a matching e2e test
#
# A wip spec's Acceptance section numbers what the change must do and tags each
# claim `[test]` (assertable in a browser) or `[eye]` (a judgement, left to
# browser-review). A `[test]` claim is a promise that an `e2e/` spec asserts it.
#
# The check matches the claim *number*, as `test("<n>: ...")`, not the wording.
# Matching the text breaks the gate on any edit to the sentence and produces
# unreadable test titles; whether the test asserts the claim rather than
# something adjacent is judgement, and belongs to diff-review.
#
# Only wip specs are checked. `/ship` deletes the Acceptance section when it
# folds a spec into docs/specs/, because by then the tests are the record.
# ---------------------------------------------------------------------------
wip_specs=$(git ls-files --cached --others --exclude-standard 'docs/specs/wip/*.md' \
	| grep -v '/README\.md$' || true)
missing=""
for spec in $wip_specs; do
	[[ -f "$spec" ]] || continue
	claims=$(sed -n '/^##[[:space:]].*Acceptance/,/^##[[:space:]]/p' "$spec" \
		| grep -oE '^[[:space:]]*([0-9]+)\.[[:space:]]*`?\[test\]`?' \
		| grep -oE '[0-9]+' || true)
	for n in $claims; do
		if ! grep -rqE "test\(\s*[\"'\`]${n}[:.]?[[:space:]]" e2e/ 2>/dev/null; then
			missing+="${spec}: claim ${n} is tagged [test] but no e2e test is named for it"$'\n'
		fi
	done
done
if [[ -n "$missing" ]]; then
	report 5 "[test] claims have e2e tests" FAIL "${missing%$'\n'}" \
		"Name the e2e test after the claim number — test(\"3: a section on hold is not suggested\") — or retag the claim [eye]."
else
	report 5 "[test] claims have e2e tests" ok
fi

# ---------------------------------------------------------------------------
# 6. Firestore rules and indexes are deployed by hand
#
# This is the diff-shaped one, and it never fails: an undeployed rule is not a
# rule, but no grep can tell whether `yarn deploy:dev` was run. What it does is
# answer diff-review's `Rules deploy needed: yes | no` header for free, so that
# field stops being a judgement call.
# ---------------------------------------------------------------------------
if [[ -z "$BASE" ]]; then
	for candidate in origin/main main; do
		if git rev-parse --verify --quiet "$candidate" >/dev/null; then BASE="$candidate"; break; fi
	done
fi
merge_base=""
[[ -n "$BASE" ]] && merge_base=$(git merge-base "$BASE" HEAD 2>/dev/null)
if [[ -z "$merge_base" && "$BASE_EXPLICIT" -eq 1 ]]; then
	echo "check-invariants: cannot resolve --base '$BASE' against HEAD" >&2
	exit 2
fi
if [[ -z "$merge_base" ]]; then
	report 6 "rules deploy" "skip (no base ref)"
else
	changed=$(
		git diff --name-only "$merge_base" HEAD
		git diff --name-only HEAD
		git ls-files --others --exclude-standard
	)
	if grep -qE '^firestore\.(rules|indexes\.json)$' <<<"$changed"; then
		report 6 "rules deploy" "needed (yarn deploy:dev)"
	else
		report 6 "rules deploy" ok
	fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\ncheck-invariants — %d files\n\n' "${#ALL_TS[@]}"
for row in "${RESULTS[@]}"; do
	IFS='|' read -r num name status <<<"$row"
	if [[ "$status" == "FAIL" ]]; then
		printf '  \033[31m%2s  %-28s %s\033[0m\n' "$num" "$name" "$status"
	else
		printf '  %2s  %-28s %s\n' "$num" "$name" "$status"
	fi
done
echo

if [[ "$FAILED" -eq 1 ]]; then
	echo "check-invariants: FAILED — see CLAUDE.md for the rule behind each." >&2
	exit 1
fi
echo "check-invariants: all pass"
