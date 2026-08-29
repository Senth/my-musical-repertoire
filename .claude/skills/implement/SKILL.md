---
name: implement
description: "Works a my-musical-repertoire spec's phases to green, one dispatch per phase, verifying each phase itself rather than trusting the report. Use in a fresh session after /new-feature, /cleanup or /bug has written a spec, or standalone inside /continue-work. Stops before review."
---

# Implement skill

Runs the **Phases** of a spec, in order, and nothing else. Planning happened in
`/new-feature`, `/cleanup` or `/bug`. Review happens in `/review`. Shipping happens in
`/ship`. [`/continue-work`](../continue-work/SKILL.md) runs all three in one session and is
the normal way in; this file is what it invokes, and it stays callable on its own.

The dispatch mechanics — the `oc-task` call shape, the report contract, the escalation
ladder — live in the global **`glm-dispatch`** skill. Read it first. They are not restated
here, and they are not copied into this repo.

Talk to the user in **unslop** prose.

## Step 0: input

A spec path, usually `docs/specs/wip/<nn>-<slug>.md`. Read it whole — it is short, it is the
contract, and it is the only thing you are carrying.

```bash
GIT_VANILLA=1 git branch --show-current
```

If it is `main`, stop and say so. Merging to `main` deploys to production.

## Step 1: the section map

Build it once and hand the same map to every phase, so no dispatch reads a 540-line area
spec to change forty lines:

```bash
grep -n '^## ' docs/specs/<area>.md
```

Pair each heading with the next heading's line to get ranges, keep the ones this spec
touches, and pass them as `<file> <start>-<end> <heading>`.

## Step 2: the phase loop

For each phase, in order:

1. **Dispatch it.** Every phase goes to GLM, including the ones that change how a screen
   looks — what a screen should look like was decided in `docs/DESIGN.md` and in the spec's
   **Surface brief**, both written before any phase ran. A spec that still names
   `feature-small` or `feature-large` on a phase is carrying a stale hint; ignore it.

   The prompt carries the spec path and **which phase** (not the spec's contents), the
   section map, the gate commands by pointing at `.ai/config.toml`, and **`ponytail` in
   `full` mode**. Ponytail is not optional and there is no short path out of it: the spec
   decided *what* to build, ponytail decides how much code that takes. Catching an
   unnecessary abstraction at write time is a deletion; catching it in `diff-review` is a
   rewrite, and this repo has paid for the rewrite version.

   When the phase touches `[review] visible_paths`, the prompt also carries `docs/DESIGN.md`
   and the Surface brief, plus design-apply's `references/principles.md`,
   `references/anti-patterns.md` and `references/checklist.md`, with that skill's Steps 1, 2
   and 5 skipped and **no browser**.

   When the phase adds a user-owned Firestore collection or a device storage key, the prompt
   says it must land in `utils/delete-account.ts` and in `clearLocalUserData`, children
   before parents.

   **A spec with fewer than three phases** is not an exemption from any of that. Doing the
   work yourself is allowed when the handoff would cost more than it saves — but it runs
   under `ponytail` in `full` mode exactly as a dispatch would.

2. **Verify it yourself.** Never take the report's word for green:

   ```bash
   yarn lint --write && yarn invariants && yarn typecheck && yarn test
   ```

   `yarn invariants` fails until every `[test]` claim has a test whose title starts with its
   number — `test("3: …")`. It therefore stays red for claims a later phase owns. Read which
   claims it names: those are the spec's phasing and you carry them forward; a claim **this**
   phase owns is yours now. Say which of the two when you report, and never rename a claim to
   silence it.

   A phase that builds a screen also owes its `e2e/` tests, in the same phase:

   ```bash
   scripts/dev-stack.sh up && yarn e2e
   ```

   If the phase touched `firestore.rules`, `yarn deploy:dev` — an undeployed rule is not a
   rule.

3. **Red?** Send the failure output back for another round, `--round <n>` from the second on.
   Two rounds. Still red, stop and report — do not move to the next phase on red.

4. **Commit.** One commit per phase, once it is green. The dispatch commits its own phase; if
   it did not, do it:

   ```bash
   GIT_VANILLA=1 git commit -m "<type>(<scope>): <phase summary>"
   ```

   A phase that is not committed is not done, whatever the report says.

5. Report the phase in one line and move on. A phase boundary is not a stop.

## Step 3: stop

When the last phase is green and committed, **stop**. Do not review your own work, do not
fold the spec, do not open a PR.

Say which phases landed, which commits, whether `firestore.rules` changed and therefore needs
`yarn deploy:dev`, whether the emulators were pristine, and anything the spec left as an open
decision. Then: run **`/review`** in a fresh session.

## What does not belong here

- **Reviewing.** The session that wrote the code never signs it off, and dispatching still
  counts as writing it.
- **Folding the wip spec into `docs/specs/`.** That is `/ship`, after a PASS.
- **Editing `docs/DESIGN.md`.** Nobody edits the contract mid-run.
- **Deciding scope.** If a phase turns out to be wrong or the spec is ambiguous, stop and
  ask. A spec changed silently during implementation is a spec nobody agreed to.
- **Committing anything outside the phase list.** Drive-by fixes belong in their own issue.
