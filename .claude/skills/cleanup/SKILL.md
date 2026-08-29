---
name: cleanup
description: "Use when deleting dead code, removing unused surface, or simplifying a flow in my-musical-repertoire, or picking up an issue labelled cleanup. Not for new features or bug fixes."
---

# Cleanup skill

A cleanup is defined by what **dies**, not by what gets built. So the skill opens with two
statements and refuses to move until both are written down:

- **What dies.** Named concretely: this component, that field, those three `t()` keys.
- **What must not change.** The behaviour that has to survive, in the player's terms.

Kickoff only: scope → branch → surface check → personas → grill → spec → hand off. This
skill ends when the spec is confirmed. Making the cut is `/continue-work`, in a fresh
session. **Do not delete anything here.**

Talk to the user in **unslop** prose. Context: [`CLAUDE.md`](../../../CLAUDE.md),
[`docs/PROJECT.md`](../../../docs/PROJECT.md),
[`docs/PERSONAS.md`](../../../docs/PERSONAS.md),
[`docs/specs/INDEX.md`](../../../docs/specs/INDEX.md).

## Cleanup is not automatically invisible

Renaming `section.phase` to `section.state` is a cleanup by label and a **visible change**
by effect: every chip, every filter and every stored document changes with it. Treating
"cleanup" as a cheap track is how a change like that ships without anyone asking what
happens to the documents already written under the old name.

So the label decides nothing. **The surface does**, and Step 3 is where that is decided.

**A field written to Firestore is never invisible. Documents already exist with it.**
Removing one from the model does not remove it from the data, so the spec has to say what
happens to those documents, whether anything migrates, and whether
`utils/delete-account.ts` still walks everything. This repo nearly shipped a field removal
as an invisible cleanup; that is why the rule is here and not in a checklist.

## Step 1. Scope it

`GIT_VANILLA=1 gh issue view <n>`, or take the description as given. Then write the two
statements and show them to the user:

```
Dies:            Section.currentBpm, the Working BPM row on the section screen,
                 and screen.sectionDetail.workingBpm
Must not change: every section keeps its phase and its practice history;
                 the BPM shown during practice is still the last achieved one
```

**Gate.** Wait for confirmation. A wrong "must not change" is the whole risk of a cleanup.

## Step 2. Branch, and move the card

Branch `cleanup/<nn>-<slug>` from `origin/main`, and move the card with the sequence in
[`bug`](../bug/SKILL.md) Step 2. That sequence exists once in this repo; do not inline a
second copy here.

## Step 3. The surface check

**Would a player or a teacher notice?**

- Yes, if the change touches a screen, a flow, wording, a suggestion, a stored field with
  history behind it, or removes something someone could be using.
- No, if it is a refactor with identical output, dead code nobody reaches, a dependency
  swap, an index, or CI.

Say which, in one line, with the reason. When unsure, treat it as visible — the cost of a
needless persona pass is small next to shipping a surprise.

Both answers end at a spec and a handoff. What changes is how much work the spec is.

### Invisible → the short spec

There is nothing for personas to react to and no surface to brief. The spec is short, and
two of its sections carry everything:

- **Why**, which for a removal means the evidence it is unused. "Nobody uses it" is a claim;
  a query, a date, a log line, a screenshot is evidence.
- **Acceptance**, which for an invisible cleanup is the evidence that behaviour is
  unchanged, and it is not "the tests pass". State it as numbered claims: no `t()` key added
  or removed, no screen touched, the same tests green before and after, and for every test
  the cut deletes, what it protected and why nothing needs protecting now.

Omit **Surface brief** and say so in **What**.

### Visible → the same path a feature takes

1. **`pianist-review`**, with the two statements from Step 1 as its input. It is very good
   at the question a removal actually raises: who was quietly relying on this? Spawn it as
   an **Opus subagent** with the `Task` tool, in **unslop** prose — see
   [`new-feature`](../new-feature/SKILL.md) Step 5 for why the persona pass is the one thing
   this repo does not dispatch to GLM.
2. **`grill-me`**, seeded with every `blocking` and `should-fix` finding and every open
   question. Fixed agenda: what happens to the documents already written under the thing
   being removed; whether a migration is needed; which `t()` keys die; what the screen looks
   like afterwards; whether `utils/delete-account.ts` and `clearLocalUserData` still walk
   everything that remains; which settled decision in `docs/PROJECT.md` or standing position
   in `docs/PERSONAS.md` this touches.
3. **A wip spec**, `docs/specs/wip/<nn>-<slug>.md`, with the same sections as a feature's —
   see [`new-feature`](../new-feature/SKILL.md) Step 7 — **including the Surface brief**. A
   removal has one like anything else, and its remove/quiet/sharpen line is the easiest in
   the repo to write: the removal *is* the remove.

## The spec

Same shape either way. Every phase goes to GLM, so no phase carries a routing hint, and a
`[test]` claim's e2e test is titled with the claim's number — `test("3: …")`.

Ideas the personas raised that the cut does not cover: **ask** which to file, file each yes,
move it to the `Idea` column in the same step with the sequence in
[`bug`](../bug/SKILL.md) Step 2, and link it from **Out of scope**. Never file one without
asking.

## Ponytail is the lens, not the discovery

You are applying `ponytail`'s question to the **plan**: is this the laziest version of this
cut? Can more die than the issue asked for, or should less? It is not a hunt for things to
delete — the issue already said what it wants gone.

Do not invoke the skill here. Plan time is not where it pays; `/continue-work` runs it at
write time, where an unnecessary abstraction is still a deletion rather than a rewrite.

Use `ponytail-audit` when you want the hunt. That is its own activity, run deliberately, not
bolted onto work that arrived already scoped.

## Deleting a test is a finding about the test

A cleanup that deletes production code usually deletes tests with it, and that is correct
when the tests only ever protected the deleted thing. It is **not** correct when a test was
the only thing asserting behaviour that survives. For every test the spec deletes, say in
one line what it protected and why nothing needs protecting now.

## Handoff

Only after the spec is written and the user has confirmed it.

1. **Ensure a tracking issue exists.** `GIT_VANILLA=1 gh issue create --label cleanup` if
   there is none, and rename the wip file to match the number.
2. **Comment the spec link on the issue.** Do not edit the issue description.
3. Tell the user to run **`/continue-work docs/specs/wip/<nn>-<slug>.md`** in a fresh
   session, and stop.
