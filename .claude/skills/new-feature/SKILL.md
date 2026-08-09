---
name: new-feature
description: "Structured new-feature kickoff for my-musical-repertoire. Use when implementing a new feature, starting work on a backlog issue, or planning the next feature. First consults the piano-practice-teacher agent for pedagogical feedback, then runs grill-me to surface requirements and edge cases before coding begins. Not for bug fixes, refactors, or chores."
---

# New Feature Skill

Orchestrates the full new-feature lifecycle: identify → pedagogy review → scope → place → spec → cleanup.

Tasks live in **GitHub Issues + the Kanban board** (Backlog / Next Up / In Progress), not in markdown. Labels: `bug`, `feature`, `idea`, `cleanup`. `TODO.md` is a generated mirror — never hand-edit it. Project context: `docs/PROJECT.md`; specs: `docs/specs/`.

## When to Use This Skill

- User says "start new feature", "work on a backlog issue", "next feature", or similar
- User is about to begin coding a feature from the GitHub board
- User wants a structured requirements session before writing code

**Not for:** bug fixes, refactors, UI polish passes, or chores.

## Workflow

### Step 1 — Identify the Feature

Look at the backlog: `gh issue list --label feature --state open` (and the board's **Next Up** column, mirrored in `TODO.md`). Read `docs/PROJECT.md` for vision/requirements context.

- If the user has specified a feature/issue, confirm it before proceeding. If it has no issue yet, note one will be created in Step 5.
- If no feature is specified, suggest the top item in **Next Up** (fall back to Backlog) and ask for confirmation before proceeding.

### Step 2 — Piano Teacher Review

Invoke the `piano-practice-teacher` agent and present the feature to it. This step always runs. Ask the teacher agent to:

- Share pedagogical concerns, ideas, or things to consider when implementing this feature
- Identify whether the feature depends on anything not yet built
- Flag any logging, lifecycle, or recommendation signals the feature should capture to keep the recommendation engine well-fed
- Call out UX choices that would make practice harder rather than easier
- Identify anything missing from the feature scope that a real teacher would expect to see

Summarise the teacher's feedback clearly for the user before proceeding.

### Step 3 — Grill Me

Invoke the `grill-me` skill, seeding it with:

1. The feature description confirmed in Step 1
2. The piano teacher's feedback from Step 2

The grilling must resolve:

- Exact scope and boundaries of the feature
- Data model requirements (Firestore collections, fields, types)
- UI/UX flows and edge cases
- How it integrates with existing lifecycle states (learning → stabilizing → maintenance)
- Logging requirements and what signals it produces for future recommendations
- Any offline / sync considerations
- Every concern or missing piece flagged by the piano teacher in Step 2

Do not proceed until grill-me reaches a shared understanding.

### Step 4 — Decide Where the Spec Lives

**Read `docs/specs/INDEX.md` first and default to extending an existing spec.**
`docs/specs/` holds **one spec per feature area**, not one per issue. A spec that only
makes sense as a diff against another spec ("supersedes §4 of X") must not exist — it
guarantees two documents that contradict each other.

- **Extend an existing spec** when the work changes behaviour that spec already
  describes — a new scoring weight, another planner rule, another field on a screen the
  spec owns. This is the common case. Edit that file in place: rewrite the affected
  sections so they describe the *new* behaviour, delete what is no longer true, and add
  the new rationale to its **Why**.
- **Write a new spec** only when the feature is a genuinely new area with its own data
  model and screens, and no existing spec would naturally grow to cover it.
- **If the work spans two specs**, update both and cross-link them rather than creating
  a third. If it makes two existing specs redundant, merge them and delete the losers —
  git history keeps the originals.

Then add or update the entry in `docs/specs/INDEX.md`.

### Step 5 — Write the Spec

Specs describe **shipped behaviour in the present tense**, so they stay useful for
maintenance. Cover:

1. **What** — one-sentence description
2. **Why** — pedagogical / product rationale, *including alternatives that were
   considered and rejected, and why*. This is the part that stops a decision being
   re-litigated later; do not trim it.
3. **Data model** — new or changed Firestore fields/collections, and any rules deploy
4. **UI flow** — screen(s) and interactions
5. **Logging** — what gets recorded and why
6. **What this does not change** — properties a reviewer might otherwise go looking for
7. **Out of scope** — explicit exclusions, with issue links where one exists
8. **Phases** — ordered implementation phases, each small enough for one sub-agent
   session. The last phase is full end-to-end testing with playwright, and the phase
   before it is the cleanup in Step 6.

Break the feature into concrete, independently deliverable phases (e.g. "Phase 1: data
model + Firestore writes", "Phase 2: UI list view", "Phase 3: recommendation signal
integration").

### Step 6 — Cleanup Phase (required, part of the plan)

The **Phases** and **Phase 0: Handoff** sections are scaffolding for the implementation
run, not part of the spec. The second-to-last phase deletes them and leaves a document
that reads as a description of the feature:

- Delete `Phase 0: Handoff` and the `Phases` section outright. Anything in them that is
  still true (a migration script's run procedure, a verified invariant) moves into the
  body first.
- Rewrite anything phrased as work to be done ("add a field", "we will") into what the
  code does now.
- Fold in whatever the implementation actually settled differently from the plan, and
  delete rules that were superseded — a "superseded by #NN" footnote is a bug in the
  spec, not a record.
- Keep it concise but keep the reasoning. Formulas, thresholds, tables and the
  rejected-alternatives rationale all stay; the value of the spec is that nobody has to
  re-derive them.
- Update `docs/specs/INDEX.md`: one row, a 1–2 sentence description of what the feature
  does, plus tags.
- Cross-link related specs by relative path instead of restating their rules.

[`section-phases.md`](../../../docs/specs/section-phases.md) is the reference for tone
and structure.

### Step 7 — Finalize Spec and Handoff

Once the spec is confirmed, add a `# Phase 0: Handoff` section to the top with instructions for the implementer agent:

- The path to the spec file (`docs/specs/<feature-name>.md`)
- Instruction to use the spec's Phases section as its implementation plan
- A reminder that the cleanup phase (Step 6) removes Phase 0 and Phases again, so nothing durable may live only in them.
- **Ensure a tracking issue exists.** Use the existing issue, or create one with `gh issue create --label feature` (it auto-lands in Backlog). As a comment to the issue, add link to the spec.
- Move the issue to **In Progress** on the board, then run `scripts/sync-todo.sh`.
- After all phases are verified working, close the issue (PR body `Closes #NN`) and run `scripts/sync-todo.sh` to refresh `TODO.md`.

### Step 8 — User Confirmation

Present the spec to the user and wait for explicit confirmation before proceeding. If the user requests changes, update the spec and confirm again.
