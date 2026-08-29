---
name: new-feature
description: "Use when starting a my-musical-repertoire feature, or picking up an issue labelled feature. Not for bugs, cleanups, or implementing a spec that already exists."
---

# New feature skill

Kickoff only: identify → branch → privacy → ask → personas → grill → spec → hand off. This
skill ends when the spec is confirmed. Building it is `/continue-work`, in a fresh session.
**Do not start coding here.**

Talk to the user in **unslop** prose. Context: [`CLAUDE.md`](../../../CLAUDE.md),
[`docs/PROJECT.md`](../../../docs/PROJECT.md),
[`docs/PERSONAS.md`](../../../docs/PERSONAS.md),
[`docs/specs/INDEX.md`](../../../docs/specs/INDEX.md),
[`docs/DESIGN.md`](../../../docs/DESIGN.md).

Not for bugs or cleanups — those have [`bug`](../bug/SKILL.md) and
[`cleanup`](../cleanup/SKILL.md). If the chosen issue is labelled `bug` or `cleanup`, say so
and ask whether to run anyway. It happens, and it is allowed; just do not do it silently.

## Step 1. Identify the feature

`GIT_VANILLA=1 gh issue list --state open --label feature`, plus the board's `Next Up`
column. Read `docs/PROJECT.md` and `docs/specs/INDEX.md` first.

- Named by the user → confirm it.
- Nothing named → propose the top of `Next Up`, falling back to `Backlog`.
- No issue yet → note that one is created in the handoff step; do not create it now.

**Gate.** Wait for confirmation before running any agent.

## Step 2. Branch, and move the card

Branch `feat/<nn>-<slug>` from `origin/main`, and move the card with the sequence in
[`bug`](../bug/SKILL.md) Step 2. That sequence exists once in this repo; do not inline a
second copy here. Three copies drifted last time, and one of them had never worked.

## Step 3. The privacy check, first

Before anything else about the design: **does this feature change what the privacy policy
says?** It needs a policy change if it collects a new kind of data, stores data somewhere
new (a Firestore collection, a device key, a third-party service), sends data anywhere, adds
analytics or crash reporting, changes retention, or changes what the user can do with their
own data. The policy is written as an exhaustive inventory, so a new collection that is not
listed makes the document wrong.

Say in one line whether it does. If it does, the spec carries a **Privacy** section and a
phase that updates `screen.privacy` / `screen.terms` in `i18n/locales/en-US.json`, bumps
`lastUpdated`, and re-runs a legal review — and the user has to plan the 30-day notice email
before the feature reaches users. See [`CLAUDE.md`](../../../CLAUDE.md).

Do this here, not at the end. This is the constraint that would force a redesign, and a data
model chosen without it is a data model that gets redesigned.

## Step 4. Ask only enough to review

Backlog issues here are one-liners ("Add on hold for sections"), and `pianist-review` stops
when its input is too thin. Ask **at most four** questions, only what the personas need in
order to be concrete: which screens, which kind of player, what triggers it, what it
replaces. Use `AskUserQuestion`.

Skip this when the issue already says enough. Data model, edge cases and boundaries belong
to the grill and must not be asked twice.

## Step 5. Pianist review

Run it only when a player or a teacher would notice: a screen, a flow, a suggestion, a
reason line, wording. Plumbing has nothing for personas to react to — an index, a rules
refactor, CI, i18n wiring, a data-model change with no visible effect. Say in one line that
you are skipping it and why.

`pianist-review` is the one thing here that stays an **Opus subagent**, spawned with the
`Task` tool. Everything that writes code is dispatched to GLM through the global
`glm-dispatch` skill; this is not that. A persona pass is plan-time judgement, and its
product is the concreteness — the twenty-two minutes before a meeting, the exam in eleven
weeks. That is exactly what a cheap model flattens back into a generic worry, so it stays
where the judgement is, and it stays in **unslop** prose rather than caveman.

Invoke it with the issue number (or the description plus the Step 4 answers) and name the
two or three personas the feature touches. Hand it the **section map** for the area specs it
should read — the ranges, not the files:

```bash
grep -n '^## ' docs/specs/<area>.md
```

Then split its findings:

- **`blocking` and `should-fix`** — mandatory topics in the grill. Each ends up resolved in
  the spec body or in **Out of scope** with the reason. None may be ignored.
- **`idea`** — list them and **ask** which to file. File each yes and move it to the `Idea`
  column in the same step, with the sequence in [`bug`](../bug/SKILL.md) Step 2, and link
  the number from the spec's **Out of scope**. Never file without asking, and never file
  them all.
- **Open questions** — seed material for the grill.

**Gate.** Present the summary and the idea list, wait, then continue.

## Step 6. Grill me

Invoke `grill-me`, seeded with the confirmed feature, the Step 4 answers, every `blocking`
and `should-fix` finding, and every open question.

Give it a **fixed agenda and a stopping condition**: settle the topics below, then stop. Not
"grill until shared understanding", which has no end. Skip any topic the issue already
answers.

- **Scope and boundaries**, and what is out.
- **Data model** — collections, fields, types, indexes, and what `utils/delete-account.ts`
  and `clearLocalUserData` must now walk, children before parents. A collection nothing
  deletes makes the privacy policy a false statement.
- **Security rules**, and whether `yarn deploy:dev` is needed before the feature works at
  all. An undeployed rule is not a rule.
- **Offline behaviour** — which writes go through `awaitWrite`, and what the UI claims while
  offline. The instrument is where the wifi is not.
- **Listener breadth** — what each new `onSnapshot` subscribes to, at David's sixty pieces.
- **UI flow** — Paper components, density, overwhelm at that repertoire size.
- **Strings** — which `t()` keys, and how the reason line reads to a student rather than to
  the database.
- **Which acceptance claims can be tested and which need eyes.** This decides the spec's
  Acceptance tags, and it is where the cost of every future review is set.
- **The surface**, when the change is user-visible: whose job it serves, the one primary
  action, what should be read first. The Surface brief is written from this.
- **Interaction with the settled decisions** in `docs/PROJECT.md` and Margit's standing
  positions in `docs/PERSONAS.md`.

Do not invoke `ponytail` here. It belongs at write time, where an unnecessary abstraction is
still a deletion rather than a rewrite, and `/continue-work` runs it there.

A genuinely unresolvable topic is recorded in the spec as an open decision rather than
ground on.

## Step 7. Write the spec

`docs/specs/wip/<nn>-<slug>.md`, where `<nn>` is the issue number. Temporary: `/ship` folds
it into an area spec and deletes it.

```
# Handoff            (wip only)
1. What              one sentence
2. Why               rationale, *including the alternatives rejected and why*
3. Data model        collections, fields, indexes, and what delete-account must walk
4. Rules             firestore.rules changes, and whether a deploy gates the feature
5. Surface brief     (wip only) — user-visible work only
6. UI flow           screens, Paper components, offline behaviour
7. Strings           new t() keys with their en-US wording
8. Logging           what gets recorded, and what future recommendation it feeds
9. Privacy           policy impact, or "none" with the reason
10. Acceptance       (wip only) numbered, tagged [test] or [eye]
11. What this does NOT change
12. Out of scope     explicit exclusions, with issue links where one exists
13. Phases           (wip only)
```

Sections a feature has nothing to put in are omitted, not left empty. Write behaviour in the
present tense, as a description of the app. **Why** is what stops a decision being re-argued
later. Never trim it.

### Surface brief

Only when the change is user-visible. It is the write-time half of the design contract:
`/continue-work` hands it to the implement stage together with `docs/DESIGN.md`, and that is
the whole brief the agent gets. A phase that has to invent the intent for itself invents a
different one each time. Five lines, no more:

```
## Surface brief
- Job:      <the persona's actual situation, named — not "the user wants to X">
- Primary:  <exactly one primary action>
- Read:     1st <…> · 2nd <…> · 3rd <…>
- Not like: <the anti-references — what this must not turn into>
- Remove / quiet / sharpen:  remove <…> · quiet <…> · sharpen <…>
```

Tokens and components belong in **UI flow**, not here. This section is intent.

### Acceptance

Numbered, one line each, every one checkable. Tag each:

- **`[test]`** — assertable in a browser. It becomes a real `e2e/` spec during the phase
  that builds it, and that test's title **starts with the claim's number** —
  `test("3: …")`. The number is the contract; matching the claim's wording would break the
  gate on every edit to the sentence and produce unreadable test titles. `yarn invariants`
  fails until every `[test]` claim has a test whose title starts with its number.
- **`[eye]`** — a judgement: wording, density, whether something reads as interactive.
  `browser-review` takes these and nothing else.

```
## Acceptance
1. [test] An on-hold section is absent from the next generated plan
2. [test] Taking a section off hold restores it to the plan without a reload
3. [eye]  The on-hold chip reads as reversible rather than as an error state
```

Prefer `[test]`. An `[eye]` claim costs an expensive browser turn on every review; a
`[test]` claim costs nothing after the day it is written. If a claim *can* be measured, it
is `[test]`.

### Phases

Vertical slices, each small enough for one dispatched session and each ending green on the
cheap gates. **Every phase goes to GLM**, so no phase carries a routing hint — and least of
all the phase that changes how a screen looks. What a screen should look like is decided in
`docs/DESIGN.md` and in the Surface brief, both written before any phase runs.

```
Phase 1  models + firestore.rules + deletion coverage
Phase 2  hooks and queries
Phase 3  UI screens + t() keys, and the e2e specs for the claims they build
```

Whichever phase builds a screen owns its tests, in the same phase. The `[test]` claims do
not become "a testing phase at the end".

Do **not** add review, cleanup or PR phases. Those are stages of `/continue-work`, and it
runs them itself.

## Step 8. Handoff

Only after the spec is written and the user has confirmed it. Present it, loop on changes
until an explicit yes.

1. **Ensure a tracking issue exists.** `GIT_VANILLA=1 gh issue create --label feature` if
   there is none, and rename the wip file to match the number.
2. **Comment the spec link on the issue.** Do not edit the issue description.
3. Tell the user to run **`/continue-work docs/specs/wip/<nn>-<slug>.md`** in a fresh
   session, and stop.

## The Handoff section of the spec

Written for a session with no context but this file. Four lines:

- This file is the implementation plan; `/continue-work` works the **Phases** in order,
  reviews, and ships.
- Read `CLAUDE.md` and the area specs cross-linked above first.
- Nothing durable lives only in **Handoff**, **Surface brief**, **Acceptance** or
  **Phases**. `/ship` deletes all four.
- The run stops at a draft PR. The merge is the user's.
