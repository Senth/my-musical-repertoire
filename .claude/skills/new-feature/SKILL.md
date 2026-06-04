---
name: new-feature
description: "Structured new-feature kickoff for my-musical-repertoire. Use when implementing a new feature, starting work on a backlog issue, or planning the next feature. First consults the piano-practice-teacher agent for pedagogical feedback, then runs grill-me to surface requirements and edge cases before coding begins. Not for bug fixes, refactors, or chores."
---

# New Feature Skill

Orchestrates the full new-feature lifecycle: identify → pedagogy review → scope → spec.

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

### Step 4 — Write the Spec

Write a concise feature spec to `docs/specs/<feature-name>.md` (create the directory if it doesn't exist) covering:

1. **What** — one-sentence description
2. **Why** — pedagogical / product rationale
3. **Data model** — new or changed Firestore fields/collections
4. **UI flow** — screen(s) and interactions
5. **Logging** — what gets recorded and why
6. **Out of scope** — explicit exclusions to prevent scope creep
7. **Phases** — ordered implementation phases, each small enough for one sub-agent session. Last phase should include full end-to-end testing with playwright.

The Phases section is required. Break the feature into concrete, independently deliverable phases (e.g., "Phase 1: data model + Firestore writes", "Phase 2: UI list view", "Phase 3: recommendation signal integration").

### Step 5 — Finalize Spec and Handoff

Once the spec is confirmed, add a `# Phase 0: Handoff` section to the top with instructions for the implementer agent:

- The path to the spec file (`docs/specs/<feature-name>.md`)
- Instruction to use the spec's Phases section as its implementation plan
- **Ensure a tracking issue exists.** Use the existing issue, or create one with `gh issue create --label feature` (it auto-lands in Backlog). Put the implementation phases as a task-list in the issue body and link the spec.
- Move the issue to **In Progress** on the board, then run `scripts/sync-todo.sh`.
- After all phases are verified working, close the issue (PR body `Closes #NN`) and run `scripts/sync-todo.sh` to refresh `TODO.md`.

### Step 6 — User Confirmation

Present the spec to the user and wait for explicit confirmation before proceeding. If the user requests changes, update the spec and confirm again.
