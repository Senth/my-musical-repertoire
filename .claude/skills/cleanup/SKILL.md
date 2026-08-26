---
name: cleanup
description: "Structured cleanup for my-musical-repertoire — deleting dead code, removing unused surface, simplifying a flow, improving UI/UX. Decides depth from whether a player would notice, so a visible cleanup gets the same treatment as a feature. Use for issues labelled cleanup. Not for new features or bug fixes."
---

# Cleanup skill

A cleanup is defined by what **dies**, not by what gets built. So the skill opens with
two statements and refuses to move until both are written down:

- **What dies.** Named concretely: this component, that field, those three `t()` keys.
- **What must not change.** The behaviour that has to survive, in the player's terms.

Talk to the user in **unslop** prose. Work lives in GitHub Issues and the Kanban board
(project 3).

## Cleanup is not automatically invisible

Renaming `section.phase` to `section.state` is a cleanup by label and a **visible
change** by effect: every chip, every filter and every stored document changes with it.
Treating "cleanup" as a cheap track is how a change like that ships without anyone
asking what happens to the documents already written under the old name.

So the label decides nothing. **The surface does**, and Step 3 is where that is
decided.

## Step 1. Scope it

`GIT_VANILLA=1 gh issue view <n>`, or take the description as given. Then write the two
statements and show them to the user:

```
Dies:            Section.currentBpm, the Working BPM row on the section screen,
                 and screen.sectionDetail.workingBpm
Must not change: every section keeps its phase and its practice history;
                 the BPM shown during practice is still the last achieved one
```

**Gate.** Wait for confirmation. A wrong "must not change" is the whole risk of a
cleanup.

## Step 2. Branch, and move the card

Branch `#<nn>-<slug>` from `origin/main`, and move the issue to In Progress with the
`gh project item-edit` sequence in [`bug`](../bug/SKILL.md).

## Step 3. The surface check

**Would a player or a teacher notice?**

- Yes, if the change touches a screen, a flow, wording, a suggestion, a stored field
  with history behind it, or removes something someone could be using.
- No, if it is a refactor with identical output, dead code nobody reaches, a dependency
  swap, an index, or CI.

Say which, in one line, with the reason. When unsure, treat it as visible — the cost of
a needless persona pass is small next to shipping a surprise.

A field that is written to Firestore is **never** invisible: documents already exist
with it. Removing one means saying what happens to those documents, and whether
`utils/delete-account.ts` still walks everything.

### Invisible → the short path

There is nothing for personas to react to and no spec to write.

1. Apply `ponytail` in `ultra` mode and make the cut.
2. The gates:
   ```bash
   yarn lint --write && yarn invariants && yarn typecheck && yarn test
   scripts/dev-stack.sh up && yarn e2e
   ```
3. **Evidence that behaviour is unchanged** — this is the acceptance criterion for an
   invisible cleanup, and it is not "the tests pass". State it: no `t()` key added or
   removed, no screen touched, the same tests green before and after, and where you
   deleted a test, why that test had nothing left to protect.
4. `/review`, then `/ship`.

### Visible → the same path a feature takes

1. **`pianist-review`**, with the two statements from Step 1 as its input. It is very
   good at the question a removal actually raises: who was quietly relying on this?
   Embed `respond and think in caveman ultra`.
2. **`grill-me`**, seeded with every `blocking` and `should-fix` finding and every open
   question. Fixed agenda: what happens to data already written under the thing being
   removed; whether a migration is needed; which `t()` keys die; what the screen looks
   like afterwards; which settled decision in `docs/PROJECT.md` or standing position in
   `docs/PERSONAS.md` this touches.
3. **A wip spec**, `docs/specs/wip/<nn>-<slug>.md`, with the same sections as a
   feature's — see [`new-feature`](../new-feature/SKILL.md). Two of them carry the
   weight here:
   - **Why**, which for a removal means the evidence it is unused. "Nobody uses it" is
     a claim; a query, a date, a screenshot is evidence.
   - **Acceptance**, where "what must not change" becomes numbered claims. A cleanup's
     acceptance is mostly about what still works.
4. **`/implement`**, then **`/review`**, then **`/ship`** — each in a fresh session.

## Ponytail is the lens, not the discovery

You are applying `ponytail` to the **plan**: is this the laziest version of this cut?
Can more die than the issue asked for, or should less? It is not a hunt for things to
delete — the issue already said what it wants gone.

Use `ponytail-audit` when you want the hunt. That is its own activity, run
deliberately, not bolted onto work that arrived already scoped.

## Deleting a test is a finding about the test

A cleanup that deletes production code usually deletes tests with it, and that is
correct when the tests only ever protected the deleted thing. It is **not** correct
when a test was the only thing asserting behaviour that survives. For every test you
delete, say in one line what it protected and why nothing needs protecting now.
