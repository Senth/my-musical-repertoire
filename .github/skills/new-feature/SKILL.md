---
name: new-feature
description: 'Structured new-feature kickoff for my-musical-repertoire. Use when implementing a new feature, starting work on a PLAN.md item, or planning the next feature. First consults the piano-practice-teacher agent for pedagogical feedback, then runs grill-me to surface requirements and edge cases before coding begins. Not for bug fixes, refactors, or chores.'
---

# New Feature Skill

A structured kickoff flow for implementing new features in my-musical-repertoire. Ensures every feature is reviewed through a pedagogy lens before requirements are locked down.

## When to Use This Skill

- User says "implement feature", "start new feature", "work on PLAN.md item", "next feature", or similar
- User is about to begin coding a feature from `PLAN.md`
- User wants a structured requirements session before writing code

**Not for:** bug fixes, refactors, UI polish passes, or chores. Use this skill only for genuine new capabilities.

## Workflow

### Step 1 — Identify the Feature

Read `@PLAN.md` to understand the full plan context.

- If the user has specified a feature, confirm it before proceeding.
- If no feature is specified, find the next unchecked item in `PLAN.md` (in phase order), suggest it to the user, and ask for confirmation before proceeding.

### Step 2 — Piano Teacher Review

Invoke the `@.github/agents/piano-practice-teacher.agent.md` agent and present the feature to it. This step always runs, regardless of how technical the feature appears. Ask the teacher agent to:

- Share any pedagogical concerns, ideas, or things to think about when implementing this feature
- Identify whether the feature is in the right phase order (does it depend on anything not yet built?)
- Flag any logging, lifecycle, or recommendation signals the feature should capture to keep the recommendation engine well-fed
- Call out any UX choices that would make practice harder rather than easier
- Identify anything missing from the feature scope that a real teacher would expect to see

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

Save the spec to `.tmp/specs/<feature-name>.md` (create the directory if it doesn't exist).

Ask the user to confirm the spec. Once confirmed:

1. Break the implementation into concrete steps and insert them as todos into the SQL `todos` table (with descriptive kebab-case IDs).
2. Start implementing, updating todo status (`in_progress` → `done`) as you go.

### Step 5 — Mark PLAN.md Complete

After all todos are done and the feature is verified working:

1. Check off the completed items in `PLAN.md` (change `- [ ]` to `- [x]`).
2. If the agreed lifecycle states or other details differ from the original PLAN wording, update the text to reflect what was actually built.
