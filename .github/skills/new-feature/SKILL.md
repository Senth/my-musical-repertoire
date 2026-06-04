---
name: new-feature
description: "Structured new-feature kickoff for my-musical-repertoire. Use when implementing a new feature, starting work on a backlog issue, or planning the next feature. First consults the piano-practice-teacher agent for pedagogical feedback, then runs grill-me to surface requirements and edge cases before coding begins. Not for bug fixes, refactors, or chores."
---

# New Feature Skill

A structured kickoff flow for implementing new features in my-musical-repertoire. Ensures every feature is reviewed through a pedagogy lens before requirements are locked down.

## When to Use This Skill

- User says "implement feature", "start new feature", "work on a backlog issue", "next feature", or similar
- User is about to begin coding a feature from the GitHub board
- User wants a structured requirements session before writing code

**Not for:** bug fixes, refactors, UI polish passes, or chores. Use this skill only for genuine new capabilities.

## Background

Tasks live in **GitHub Issues + the Kanban Project board** (columns: Backlog / Next Up / In Progress), not in markdown. Labels: `bug`, `feature`, `idea`, `cleanup`. [`TODO.md`](../../../TODO.md) is a generated mirror — never hand-edit it. Project context lives in [`docs/PROJECT.md`](../../../docs/PROJECT.md); per-feature specs in [`docs/specs/`](../../../docs/specs/).

## Workflow

### Step 1 — Identify the Feature

Look at the backlog: `gh issue list --label feature --state open` (and the board's **Next Up** column via `TODO.md`).

- If the user specified a feature/issue, confirm it before proceeding. If it has no issue yet, note that one will be created in Step 4.
- If no feature is specified, suggest the top item in **Next Up** (fall back to Backlog), then ask for confirmation before proceeding.

Read [`docs/PROJECT.md`](../../../docs/PROJECT.md) for vision/requirements context, and any linked spec in [`docs/specs/`](../../../docs/specs/).

### Step 2 — Piano Teacher Review

Invoke the `@.github/agents/piano-practice-teacher.agent.md` agent and present the feature to it. This step always runs, regardless of how technical the feature appears. Ask the teacher agent to:

- Share any pedagogical concerns, ideas, or things to think about when implementing this feature
- Flag any logging, lifecycle, or recommendation signals the feature should capture to keep the recommendation engine well-fed
- Call out any UX choices that would make practice harder rather than easier
- Identify anything missing from the feature scope that a real teacher would expect to see
- Note dependencies on capabilities that aren't built yet

Summarise the teacher's feedback clearly for the user before proceeding.

### Step 3 — Grill Me

Invoke the `grill-me` skill, seeding it with:

1. The feature description confirmed in Step 1
2. The piano teacher's feedback from Step 2

The grilling should resolve:

- Exact scope and boundaries of the feature
- Data model requirements (Firestore collections, fields, types)
- UI/UX flows and edge cases
- How it integrates with existing lifecycle states (learning → stabilizing → maintenance)
- Logging requirements and what signals it produces for future recommendations
- Any offline / sync considerations
- Every concern or missing piece flagged by the piano teacher in Step 2

Do not start implementing until the grill-me session reaches a shared understanding and the user gives the go-ahead.

### Step 4 — Spec, Confirm, and Implement

After grill-me, write a concise feature spec covering:

1. **What** — one-sentence description
2. **Why** — pedagogical / product rationale
3. **Data model** — new or changed Firestore fields/collections
4. **UI flow** — screen(s) and interactions
5. **Logging** — what gets recorded and why
6. **Out of scope** — explicit exclusions to prevent scope creep

Save the spec to `docs/specs/<feature-name>.md`.

Ask the user to confirm the spec. Once confirmed:

1. **Ensure a tracking issue exists.** If working from an existing issue, update its body with a task-list (`- [ ]`) of the implementation steps and link the spec. If no issue exists yet, create one: `gh issue create --label feature --title "..." --body "..."` (it auto-lands in Backlog).
2. **Move the issue to In Progress** on the board, then run `scripts/sync-todo.sh` so `TODO.md` reflects it.
3. Track implementation sub-steps via the issue's task-list (and/or the harness task tools), checking them off as you go.
4. Start implementing.

### Step 5 — Close Out

After all steps are done and the feature is verified working:

1. Reference the issue from the PR/commit body with `Closes #NN` so it closes on merge (or close it manually once shipped).
2. Run `scripts/sync-todo.sh` to refresh `TODO.md`.
3. If the agreed lifecycle states or other details differ from the original issue wording, update the spec in `docs/specs/` to reflect what was actually built.
