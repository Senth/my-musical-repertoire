---
name: review
description: "Independent review gate for my-musical-repertoire. Runs the mechanical gates, then diff-review and ponytail-review in parallel, then — only if the change is user-visible — browser-review, committing each fix round. Use after implementing, before /ship. Not for planning or for reviewing someone else's PR."
---

# Review skill

The session that wrote the code does not sign it off. Run this in a **fresh session**: it
starts nearly empty, reads only the diff, the findings and the files it must touch, so every
fix round lands on a small context instead of on top of an entire implementation.

**You are the fix loop.** The agents are read-only by design. Never give a reviewer write
access, and never ask a reviewer to fix its own finding.

The dispatch mechanics live in the global **`glm-dispatch`** skill; read it first.
[`/continue-work`](../continue-work/SKILL.md) invokes this as its second stage, and this file
stays callable on its own.

Talk to the user in **unslop** prose — plain, direct, no filler. Not caveman: this output is
small and you read it every run, so clarity beats compression. The agents are the ones under
caveman.

## The order, and why

Free things first, then cheap things, then expensive things.

```
lint --write → invariants → typecheck → test → e2e   (zero tokens; a shell command each)
        ↓
diff-review  ‖  ponytail-review                       (tokens; diff-review decides visible)
        ↓
browser-review                                        (most tokens; only if user-visible)
```

Every mechanical gate runs before any agent is dispatched. A failure one of them catches is a
round of agent review you did not have to pay for. `diff-review` and `ponytail-review` touch
nothing, so they run together; `browser-review` runs after them and after their fixes,
because a code fix invalidates a browser pass.

Flags: `/review` (auto), `/review --code` (no browser pass, whatever `diff-review` says),
`/review --quick` (mechanical gates plus `diff-review`, and you smoke-test the primary path by
hand). There is no third flag.

## Step 1. Scope

```bash
GIT_VANILLA=1 git status --porcelain
GIT_VANILLA=1 git diff --name-only main...HEAD
```

Only `docs/ .claude/ .ai/ scripts/ .github/ README.md` changed → say so in two lines and
stop. An empty diff stops the run. Everything else continues; `diff-review` decides whether
the browser pass happens, not you and not a path table.

## Step 2. The section map

The agents must not read whole area specs — `section-phases.md` alone is 540 lines. Work out
which sections this diff touches and hand over exact ranges:

```bash
grep -n '^## ' docs/specs/<area>.md
```

Pair each heading with the next heading's line number to get a range, pick the ones the diff
actually touches, and pass them as `<file> <start>-<end> <heading>`. State the map in chat so
it is auditable.

## Step 3. The mechanical gates

```bash
yarn lint --write && yarn invariants && yarn typecheck && yarn test
scripts/dev-stack.sh up && yarn e2e
```

All green before an agent is dispatched. `dev-stack.sh up` is idempotent — it reuses a stack
you already had running and reports whether the emulators are pristine from `.emulator-seed/`
or carrying whatever a previous session left in them; `scripts/dev-stack.sh status` says the
same on demand. Say which in the final report.

If the diff touched `firestore.rules`, run `yarn deploy:dev` before concluding anything about
permissions — an undeployed rule is not a rule, and "Missing or insufficient permissions" is
usually this.

An `e2e` failure is a `blocking` finding you fix yourself, right here. It is also the cheapest
signal in the whole run, so never skip it to save wall-clock time.

### What e2e already covers, and what it does not

`e2e/craft.spec.ts` decides these exactly, on every route, on every run — so no agent spends
a turn on them:

- console errors and warnings
- raw `t()` keys rendered on screen
- horizontal scroll at the phone viewport
- WCAG contrast in both colour schemes

And these are **not covered**, so the agents keep looking at them:

- **touch targets under 48dp** — deliberately omitted, see #113; every Paper control renders
  below the minimum today, so the check would fail on every route
- axe violations, clipped control labels, the app-bar title at 200% zoom, the desktop header

Keep this list honest. A check named here that the suite does not run is the one thing that
stops the only agent who could have caught it from looking.

## Step 4. The two read-only reviews, in parallel

```bash
oc-task diff-review ~/git/my-musical-repertoire .tmp/prompts/diff-review.md \
  --label <issue>/review-diff &
oc-task review      ~/git/my-musical-repertoire .tmp/prompts/ponytail-review.md \
  --label <issue>/review-ponytail &
wait
```

`diff-review` gets the issue number, the spec path, the section map and the **full diff**.
The `review` agent gets the diff and one instruction: run the `ponytail-review` skill against
it and report only over-engineering. Never hand either one your own account of what you built
or why it is correct — that sentence is what turns a reviewer into a rubber stamp.

`diff-review`'s report carries **`User-visible: yes | no`**, which decides Step 5, and
**`Rules deploy needed: yes | no`**. With `--code` or `--quick`, skip to Step 6 regardless
and say so.

## Step 5. browser-review

Only when `diff-review` said yes.

```bash
scripts/dev-stack.sh up          # prints WEB_URL=
scripts/dev-stack.sh ports       # the same port, on demand
```

Take the URL from what `up` prints or from `ports`, never from memory — the web port is
derived from the checkout directory, so a worktree runs on a different one.

Hand it: the issue number, the spec path, the section map, the list of **changed screens**,
and that URL. Not the diff, and not your account of the change.

It judges what a test cannot: whether it looks right, whether the wording sounds like a
musician, whether an empty state is honest, whether the density overwhelms. It has a 15-turn
budget, and every finding it keeps cites a rule in `docs/DESIGN.md` or is flagged a taste
call. If it comes back having spent its turns on something the list in Step 3 says is
covered, that is a bug in the agent file, not a finding — say so.

## Step 6. The fix loop

Read the reports. Print one severity-ordered table: severity, source, finding, fix.

- **`blocking`.** Must be fixed. Never deferrable, by anyone.
- **`should-fix`.** Fix it, or defer it by writing one line of reason into the report. A
  silent skip is not a defer.
- **`idea`.** Never acted on here. List them and **ask** which to file, then file each yes and
  move it to the `Idea` column in the same step, with the sequence in
  [`bug`](../bug/SKILL.md) Step 2. The rest are dropped. Never file one without asking, and
  never file them all by default.

While not PASS and rounds used **< 2**:

1. Apply the fixes.
2. Re-run the mechanical gates. All green.
3. **Commit the round**, with a message naming the finding it closes. Review never hands over
   with a dirty tree, and it never reaches the ideas question with one either: fixes made,
   gates green, nothing committed, next session inherits a mess.
4. **Re-run scoped, not whole.** Hand the agent the list of fixes and ask it to verify exactly
   those. Do not re-run `diff-review` unless a fix changed logic rather than presentation.
5. Count the round.

**PASS** = zero `blocking` and zero outstanding `should-fix`, and it is yours to declare. A
green report is not a PASS.

After two rounds without a PASS, **stop**. Print what is outstanding, say which rounds were
spent, ask how to proceed. Do not keep grinding.

## Step 7. Report, and tear down

State plainly: PASS or NOT PASS, rounds used, what was fixed, what was deferred and why,
which ideas were filed, whether the emulators were pristine, and whether `firestore.rules`
still needs deploying. If no browser pass happened, say why — `diff-review` said not
user-visible, or a flag — and what you smoke-tested by hand instead.

A finding that argues `docs/DESIGN.md` is wrong is collected as **one proposed diff for the
user**, never applied. Nobody edits the contract mid-run, and no agent may widen a rule so
that its own change passes.

```bash
scripts/dev-stack.sh down
playwright-cli -s=review close
```

Only if you started the stack. `down` stops what it started and leaves anything else alone.

Reports and screenshots stay in `.tmp/`. Gitignored, never committed, nothing posted to
GitHub.

On a PASS, tell the user to run **`/ship`** in a fresh session. Do not fold the spec, open a
PR or merge from here.

## The seed fixture

`.emulator-seed/` is committed and produced **by the app**, never hand-written — see
[`docs/OPERATIONS.md`](../../../docs/OPERATIONS.md) for the regeneration procedure, what it
holds, and the two traps that cost real time.

It is a contract with `e2e/support/app.ts`: the seeded account, the readiness markers, and
every title a spec waits on. `/ship` refreshes it when the work adds data worth having in
every future review. **A stale fixture is a `blocking` finding on the change that broke it.**
