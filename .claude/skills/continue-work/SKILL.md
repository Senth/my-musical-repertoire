---
name: continue-work
description: "Use when a my-musical-repertoire spec is confirmed and ready to build, or to resume a run that stopped partway. Not for deciding what to build."
---

# Continue work — my-musical-repertoire

One session takes a confirmed spec to a draft PR: implement every phase, review, ship.

This skill **inherits the global `continue-work` skill**. The stage order, the checkpoint
format, the commit-per-stage rule and the stop rules are all defined there and are not
restated here. What follows is this repo's own: its gate commands, its agents, its ship
steps. All dispatch mechanics — the `oc-task` call shape, the report contract, the
escalation ladder, the parallelism rules — live in the global **`glm-dispatch`** skill. Read
both first.

You are the driver, not the worker. Everything that writes code is dispatched to GLM. The
spec, the dispatch and the PASS/FAIL stay with you.

Talk to the user in **unslop** prose — plain, direct, no filler. Not caveman: this output is
small and read every run, so clarity beats compression. The agents are the ones under
caveman.

## Resume before anything else

```bash
cat .tmp/continue-work.state.json 2>/dev/null
GIT_VANILLA=1 git status --porcelain     # must be empty
GIT_VANILLA=1 git log --oneline -1       # must match the checkpoint's commit
GIT_VANILLA=1 git branch --show-current  # must not be main
```

A checkpoint whose `spec` matches what you were handed, or any checkpoint at all when you
were handed nothing, means you are resuming. Announce it in one line — spec, phase n/m,
stage, what happens next — and pick up there. Do not re-implement a finished phase and do
not re-review a stage that was green.

A dirty tree or a mismatched HEAD means somebody worked outside the run. Stop and ask.

On `main`, stop. Merging a PR here deploys to production, so nothing is built on `main`.

No checkpoint → this is a fresh run. Read the spec whole. It is short, it is the contract,
and it is the only thing you carry.

## The gates

The cheap four, in this order, from `.ai/config.toml`, after every green report:

```bash
yarn lint --write && yarn invariants && yarn typecheck && yarn test
```

`lint --write` fixes what it can and goes first, so everything after it sees formatted
source. `e2e` is not a per-phase gate — it needs the stack, and the stack takes minutes:

```bash
scripts/dev-stack.sh up && yarn e2e
```

`dev-stack.sh up` is idempotent: it reuses a stack that is already running and says whether
the emulators are pristine from `.emulator-seed/` or carrying whatever a previous session
left in them. `scripts/dev-stack.sh status` says the same thing on demand. Note which, and
report it at the end — a run against a non-pristine emulator has seen different data than
the next one will.

The full suite runs twice: inside the last implement phase's dispatch, and once more after
review and its fixes, before `browser-review` and ship. Fix rounds re-run only what they
touched.

If the phase touched `firestore.rules`, run `yarn deploy:dev` before concluding anything
about permissions. Rules and indexes are deployed by hand to a shared dev project here, and
an undeployed rule is not a rule — it is the usual cause of "Missing or insufficient
permissions".

**You run these yourself after every green report.** A green report is a claim. This costs
no tokens and one shell command each, and when your run disagrees with the report, the
report is wrong: the stage is red and your output is what goes into the next round's prompt.

## Stage 1 — implement, once per spec phase

For each phase in the spec's **Phases**, in order. One phase, one dispatch, one writer;
never two writing processes against this working tree.

1. **Write the prompt to a file** under `.tmp/prompts/`, stable part first so the retry hits
   the cache. It carries:

   - the spec path and **which phase**, not the spec's contents
   - the **section map** — exact line ranges of the area specs this phase touches, from
     `grep -n '^## ' docs/specs/<area>.md`, paired with the next heading's line. Never let a
     phase read a whole area spec; `section-phases.md` is 540 lines and almost none of it is
     about this phase
   - the gate commands, by pointing at `.ai/config.toml`'s `[gates]`
   - `ponytail` in **full** mode, always, including on a two-phase spec. Catching an
     unnecessary abstraction at write time is a deletion; catching it in diff-review is a
     rewrite, and this repo has paid for the rewrite version
   - **when the phase touches `[review] visible_paths`**: `docs/DESIGN.md` and the spec's
     **Surface brief**, plus design-apply's `references/principles.md`,
     `references/anti-patterns.md` and `references/checklist.md`. The agent skips
     design-apply's Steps 1, 2 and 5 — discovery is answered by the contract, the mode is
     always **conform**, and verification is the gate's job and `browser-review`'s. **It
     never boots a browser.**
   - **when the phase adds a user-owned collection or a device storage key**: that it must
     land in `utils/delete-account.ts` and in `clearLocalUserData`, children before parents.
     Account deletion is a promise in the privacy policy, not a feature.

2. **Dispatch.**

   ```bash
   oc-task implement ~/git/my-musical-repertoire .tmp/prompts/implementation-<n>.md \
     --label <issue>/implementation-<n>
   ```

   **Run it in the background** and watch
   `.tmp/dispatch/<issue>/implementation-<n>/progress.log`. A phase is long — the e2e suite
   alone needs the emulator stack up — so a foreground dispatch cannot finish inside the
   Bash tool's ten-minute cap. Give the user the log path when you announce the dispatch.
   That dir is where everything the dispatch produces lands. Never treat a report file that
   was already sitting there as this dispatch's — `oc-task` wipes the dir at launch, so the
   only report that exists is the one the command you just ran prints a path for.

   Every phase goes to GLM, including the ones that change how a screen looks, and so does
   every review stage below. A spec written before that was settled may still hint
   `feature-small` or `Opus` on a phase; the hint is stale, and the phase is dispatched here
   like any other. Nothing this skill dispatches runs on Claude.

3. **Re-run the gates yourself.** Red or blocked → the escalation ladder in `glm-dispatch`,
   `--round <n>` from the second round on.

   `yarn invariants` check 5 is the exception. It fails until every `[test]` claim has a test
   whose title starts with its number, so it stays red for the claims later phases have not
   written yet. Read which claims it names before you treat it as this phase's problem:
   claims a later phase owns are the spec's phasing, and you carry them in the checkpoint as
   `red: invariants, owed by phase n`. A claim **this** phase owns is yours now, because
   nothing downstream is coming for it. Say which of the two when you report, and never work
   around it by renaming a claim.

4. **Confirm the commit.** The stage commits its own phase. Check the tree is clean and HEAD
   moved. A phase that is not committed is not done, whatever the report says.

5. **Checkpoint**, then report the phase in one line and move on. A phase boundary is not a
   stop. Announce, checkpoint, dispatch the next phase. Never pause to ask whether to
   continue; the stop rules in the global skill are the only stops there are.

Whichever phase builds a screen owns its `e2e/` tests in the same phase.

## Stage 2 — review

The session that wrote the code does not sign it off, and dispatching agents still counts as
writing it. That is why the reviewers are separate processes with no memory of the build.

Free things first, then cheap, then expensive:

```
lint --write → invariants → typecheck → test        (zero tokens; a shell command each)
        ↓
diff-review  ‖  ponytail-review                     (tokens; diff-review decides visible)
        ↓
e2e, the whole suite, once                          (the double-check after the fix rounds)
        ↓
browser-review                                      (most tokens; only if user-visible)
```

**Every cheap gate is green before any agent is dispatched.** A failure a gate catches is a
round of agent review nobody had to pay for. The full e2e suite runs once, after the fix
rounds and before `browser-review`: a failure there is a `blocking` finding you fix right
here.

### The two read-only reviews, in parallel

They touch nothing, so they run together:

```bash
oc-task diff-review ~/git/my-musical-repertoire .tmp/prompts/diff-review.md \
  --label <issue>/review-diff &
oc-task review      ~/git/my-musical-repertoire .tmp/prompts/ponytail-review.md \
  --label <issue>/review-ponytail &
wait
```

`diff-review` gets the issue number, the spec path, the section map and the full diff. The
`review` agent gets the diff and one instruction: run the `ponytail-review` skill against it
and report only over-engineering. Neither one gets your account of what you built or why it
is correct — that sentence is what turns a reviewer into a rubber stamp.

`diff-review`'s report carries **`User-visible: yes | no`**, which gates the last step and is
not optional, and **`Rules deploy needed: yes | no`**, which tells you whether `yarn
deploy:dev` has to run before anything about permissions means anything.

### The fix rounds

You decide which findings are real. A reviewer wrong about this repo's conventions is
common, and acting on a false finding costs a round.

- **`blocking`** — fixed. Never deferrable.
- **`should-fix`** — fixed, or deferred with one written line of reason. A silent skip is
  not a defer.
- **`idea`** — never acted on here. List them and **ask** which to file, then file each yes
  and move it to the `Idea` column in the same step, with the sequence in
  [`bug`](../bug/SKILL.md) Step 2. The rest are dropped. Never file one without asking, and
  never file them all.

Each round: dispatch the fixes as one unit, one writer at a time, with
`--label <issue>/review-fix-<round>` and `--round <round>`. Re-run the cheap gates, plus the
targeted e2e run for what the fixes touched. **When they are green, commit the round with a
message naming the finding it closes**, then checkpoint with `rounds` incremented.

> Review never hands over with a dirty tree, and it never reaches the ideas question with one
> either. Fixes made, gates green, nothing committed, next session inherits a mess — that is
> the known failure this rule exists to close.

Re-run the reviewer **scoped**, not whole: hand it the finding list and the diff of just your
fixes and ask it to verify those. Do not re-run `diff-review` unless a fix changed logic
rather than presentation.

**PASS** = zero `blocking` and zero outstanding `should-fix`, and it is yours to declare. A
green report is not a PASS. Three fix rounds inside this stage without one, and you stop.

### browser-review, last and often not at all

Only when `diff-review` said `User-visible: yes`. It goes after the other reviews and their
fixes have landed and the gates are green, because a code fix invalidates a browser pass. It
is the expensive stage, and a browser pass on a change nobody can see is pure cost.

```bash
scripts/dev-stack.sh up          # prints WEB_URL=
scripts/dev-stack.sh ports       # the same port, on demand
oc-task browser-review ~/git/my-musical-repertoire .tmp/prompts/browser-review.md \
  --label <issue>/browser-review
```

Take the URL from what `up` prints or from `ports`, never from memory — the web port is
derived from the checkout directory, so a worktree is on a different one. Hand the agent the
issue number, the spec path, the section map, the list of **changed screens** from
`diff-review`, and that URL. Not the diff.

Its findings are another fix round under the same commit-then-checkpoint rule. If it comes
back having spent its 15 turns on something `e2e/craft.spec.ts` already covers, that is a bug
in the agent file, not a finding — say so.

Checkpoint the finished stage even when nothing needed fixing and no round ever ran.

## Stage 3 — ship

Run [`/ship`](../ship/SKILL.md) as written: fold the wip spec into its area spec and delete
it, update the row in `docs/specs/INDEX.md`, deploy the rules if they changed, refresh
`.emulator-seed/` if the work added data every future review should see, commit, push, and
open a **draft** PR with `--fill --body "Closes #<nn>"`. Call out in the body any earlier
commits on the branch that are not part of this issue — they ship with it.

`Handoff`, `Surface brief`, `Acceptance` and `Phases` are scaffolding and do not survive the
fold.

Then watch CI — the workflow is named `PR` — checkpoint, **delete the checkpoint file**, and
give the user the PR URL. The merge is theirs: merging deploys to production.

## Tear down

Only if you started the stack:

```bash
scripts/dev-stack.sh down
playwright-cli -s=review close
```

Reports, prompts and screenshots stay in `.tmp/`. Gitignored, never committed, nothing posted
to GitHub.

## The standalone stages still exist

[`/implement`](../implement/SKILL.md), [`/review`](../review/SKILL.md) and
[`/ship`](../ship/SKILL.md) remain callable on their own, for a run that does not want the
whole arc or for picking a single stage back up by hand. This skill invokes them; it does not
replace them.

## What never happens here

- Reading a raw diff, a test log or a transcript. You read reports, file lists, gate exit
  codes and `git diff --stat` line counts. A failing gate's output goes into the next round's
  prompt; it is not yours to debug.
- Writing code yourself. Everything that writes is dispatched.
- Marking a stage green on the strength of a report alone.
- Redesigning mid-run. A spec that turns out to be wrong is a human conversation, not a fix
  round.
- Editing `docs/DESIGN.md`. Proposed rule changes are collected as one diff for the user.
- A non-draft PR, or a merge.
