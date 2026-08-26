---
name: new-feature
description: "Structured new-feature kickoff for my-musical-repertoire. Runs pianist-review when the feature has user-visible surface, then a bounded grill-me, then writes a temporary implementation spec under docs/specs/wip/ and hands off to /implement. Stops before implementation. Not for bug fixes or cleanups."
---

# New feature skill

Kickoff only: identify → branch → ask → personas → grill → spec → hand off. This skill
ends when the spec is confirmed. Implementation is `/implement`, in a fresh session.
**Do not start coding here.**

Talk to the user in **unslop** prose. Context:
[`docs/PROJECT.md`](../../../docs/PROJECT.md),
[`docs/PERSONAS.md`](../../../docs/PERSONAS.md),
[`docs/specs/INDEX.md`](../../../docs/specs/INDEX.md).

Not for bugs or cleanups — those have [`bug`](../bug/SKILL.md) and
[`cleanup`](../cleanup/SKILL.md). If the chosen issue is labelled `bug` or `cleanup`,
say so and ask whether to run anyway. It happens, and it is allowed; just do not do it
silently.

## Step 1. Identify the feature

`GIT_VANILLA=1 gh issue list --state open --label feature`, plus the board's Next Up
column (mirrored in `TODO.md`). Read `docs/PROJECT.md` and `docs/specs/INDEX.md` first.

- Named by the user → confirm it.
- Nothing named → propose the top of Next Up, falling back to Backlog.
- No issue yet → note that one is created in Step 8; do not create it now.

**Gate.** Wait for confirmation before running any agent.

## Step 2. Branch, and move the card

Branch `#<nn>-<slug>` from `origin/main`. Move the issue to In Progress:

```bash
NN=<issue-number>
P=$(GIT_VANILLA=1 gh project view 3 --owner Senth --format json | jq -r .id)
F=$(GIT_VANILLA=1 gh project field-list 3 --owner Senth --format json \
    | jq -r '.fields[] | select(.name=="Status") | .id')
O=$(GIT_VANILLA=1 gh project field-list 3 --owner Senth --format json \
    | jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="In Progress") | .id')
I=$(GIT_VANILLA=1 gh project item-list 3 --owner Senth --format json --limit 500 \
    | jq -r --arg n "$NN" '.items[] | select(.content.number == ($n|tonumber)) | .id')
GIT_VANILLA=1 gh project item-edit --project-id "$P" --id "$I" \
    --field-id "$F" --single-select-option-id "$O"
scripts/sync-todo.sh
```

Missing project scope → `gh auth refresh -s project` and retry; still failing → say so
and ask the user to move the card by hand.

## Step 3. The privacy check, first

Before anything else about the design: **does this feature change what the privacy
policy says?** It needs a policy change if it collects a new kind of data, stores data
somewhere new (a Firestore collection, a device key, a third-party service), sends data
anywhere, adds analytics or crash reporting, changes retention, or changes what the
user can do with their own data. The policy is written as an exhaustive inventory, so a
new collection that is not listed makes the document wrong.

Say in one line whether it does. If it does, the spec carries a **Privacy** section and
a phase that updates `screen.privacy` / `screen.terms` in `i18n/locales/en-US.json`,
bumps `lastUpdated`, and re-runs a legal review — and the user has to plan the 30-day
notice email before the feature reaches users. See
[`.claude/CLAUDE.md`](../../CLAUDE.md).

Do this here, not at the end. A data model chosen without it is a data model that gets
redesigned.

## Step 4. Ask only enough to review

Backlog issues here are one-liners ("Add on hold for sections"), and `pianist-review`
stops when its input is too thin. Ask **at most four** questions, only what the
personas need to be concrete: which screens, which kind of player, what triggers it,
what it replaces. Use `AskUserQuestion`.

Skip this when the issue already says enough. Data model, edge cases and boundaries
belong to Step 6 and must not be asked twice.

## Step 5. Pianist review

Run it only when a player or a teacher would notice: a screen, a flow, a suggestion, a
reason line, wording. Plumbing has nothing for personas to react to — an index, a rules
refactor, CI, i18n wiring, a data-model change with no visible effect. Say in one line
that you are skipping it and why.

Invoke `pianist-review` with the issue number (or the description plus the Step 4
answers), name the two or three personas the feature touches, and embed `respond and
think in caveman ultra`. Hand it the **section map** for the area specs it should read
— the ranges, not the files:

```bash
grep -n '^## ' docs/specs/<area>.md
```

Then split its findings:

- **`blocking` and `should-fix`** — mandatory topics in Step 6. Each ends up resolved in
  the spec body or in **Out of scope** with the reason. None may be ignored.
- **`idea`** — list them and **ask** which to file. For each yes:
  `GIT_VANILLA=1 gh issue create --label idea`, then `scripts/sync-todo.sh`, and link
  the number from the spec's **Out of scope**. Never file without asking.
- **Open questions** — seed material for Step 6.

**Gate.** Present the summary and the idea list, wait, then continue.

## Step 6. Grill me

Invoke `grill-me`, seeded with the confirmed feature, the Step 4 answers, every
`blocking` and `should-fix` finding, and every open question.

Give it a **fixed agenda and a stopping condition**: settle the topics below, then
stop. Not "grill until shared understanding", which has no end. Skip any topic the
issue already answers.

- Scope and boundaries, and what is out
- Data model: collections, fields, types, indexes, and what deletion must now walk
- Security rules changes, and whether `yarn deploy:dev` is needed before the feature works
- Offline behaviour: which writes go through `awaitWrite`, what the UI claims while offline
- UI flow, Paper components, density, overwhelm at David's repertoire size
- Strings: which `t()` keys, and how the reason line reads to a student
- **Which acceptance claims can be tested and which need eyes** — this decides Step 7
- Interaction with the settled decisions in `docs/PROJECT.md` and Margit's standing
  positions in `docs/PERSONAS.md`

A genuinely unresolvable topic is recorded in the spec as an open decision rather than
ground on.

## Step 7. Write the spec

`docs/specs/wip/<nn>-<slug>.md`, where `<nn>` is the issue number. Temporary: `/ship`
folds it into an area spec and deletes it.

```
# Handoff            (wip only)
1. What              one sentence
2. Why               rationale, *including the alternatives rejected and why*
3. Data model        collections, fields, indexes, and what delete-account must walk
4. Rules             firestore.rules changes, and whether a deploy gates the feature
5. UI flow           screens, Paper components, offline behaviour
6. Strings           new t() keys with their en-US wording
7. Logging           what gets recorded, and what future recommendation it feeds
8. Privacy           policy impact, or "none" with the reason
9. Acceptance        (wip only) numbered, tagged [test] or [eye]
10. What this does NOT change
11. Out of scope     explicit exclusions, with issue links where one exists
12. Phases           (wip only)
```

Write behaviour in the present tense, as a description of the app. **Why** is what
stops a decision being re-argued later. Never trim it.

### Acceptance

Numbered, one line each, every one checkable. Tag each:

- **`[test]`** — assertable in a browser. It becomes a real `e2e/` spec during the phase
  that builds it, and `yarn invariants` checks that a test with a matching title
  exists. The mapping is literal: **the test title is the claim text**, so write the
  claim as something a test can be called.
- **`[eye]`** — a judgement: wording, density, whether something reads as interactive.
  `browser-review` takes these and nothing else.

```
## Acceptance
1. [test] An on-hold section is absent from the next generated plan
2. [test] Taking a section off hold restores it to the plan without a reload
3. [eye]  The on-hold chip reads as reversible rather than as an error state
```

Prefer `[test]`. An `[eye]` claim costs an expensive browser turn on every review; a
`[test]` claim costs nothing after the day it is written. If a claim *can* be measured,
it is `[test]`.

### Phases

Vertical slices, each small enough for one sub-agent session and each ending green on
`yarn lint --write`, `yarn invariants`, `yarn typecheck` and `yarn test`. Name the
agent size per phase — `feature-small` or `feature-large` — so `/implement` does not
have to guess.

```
Phase 1  models + firestore.rules + deletion coverage   feature-large
Phase 2  hooks and queries                              feature-small
Phase 3  UI screens + t() keys                          feature-small
Phase 4  e2e specs for the [test] acceptance claims     feature-small
```

**Phase 4 is not optional** when the feature is user-visible: the `[test]` claims
become tests in the same change, not later. Whichever phase builds a screen owns its
tests.

Do **not** add review, cleanup or PR phases. Those are `/review` and `/ship`, and each
is its own session.

## Step 8. Handoff

Only after the spec is written and the user has confirmed it. Present it, loop on
changes until an explicit yes.

1. **Ensure a tracking issue exists.** `GIT_VANILLA=1 gh issue create --label feature`
   if there is none, then `scripts/sync-todo.sh`, and rename the wip file to match the
   number.
2. **Comment the spec link on the issue.** Do not edit the issue description.
3. Tell the user to run **`/implement docs/specs/wip/<nn>-<slug>.md`** in a fresh
   session, and stop.

## The Handoff section of the spec

Written for a session with no context but the file. Keep it to four lines:

- This file is the implementation plan; `/implement` works the **Phases** in order.
- Read `.claude/CLAUDE.md` and the area specs cross-linked above first.
- Nothing durable may live only in **Handoff**, **Acceptance** or **Phases**. `/ship`
  deletes all three.
- After the last phase: `/review` in a fresh session, then `/ship` on a PASS.
