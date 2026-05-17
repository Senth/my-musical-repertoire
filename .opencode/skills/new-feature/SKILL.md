---
name: new-feature
description: "Structured new-feature kickoff for my-musical-repertoire. Use when implementing a new feature, starting work on a PLAN.md item, or planning the next feature. First consults the piano-practice-teacher agent for pedagogical feedback, then runs grill-me to surface requirements and edge cases before coding begins. Not for bug fixes, refactors, or chores."
---

# New Feature Skill

Orchestrates the full new-feature lifecycle: identify → pedagogy review → scope → spec → delegate to feature-large for implementation. Owns everything up to implementation; feature-large owns implementation.

## When to Use This Skill

- User says "implement feature", "start new feature", "work on PLAN.md item", "next feature", or similar
- User is about to begin coding a feature from `PLAN.md`
- User wants a structured requirements session before writing code

**Not for:** bug fixes, refactors, UI polish passes, or chores.

## Workflow

### Step 1 — Identify the Feature

Read `PLAN.md` to understand the full plan context.

- If the user has specified a feature, confirm it before proceeding.
- If no feature is specified, find the next unchecked item in `PLAN.md` (in phase order), suggest it to the user, and ask for confirmation before proceeding.

### Step 2 — Piano Teacher Review

Invoke the `piano-practice-teacher` agent and present the feature to it. This step always runs. Ask the teacher agent to:

- Share pedagogical concerns, ideas, or things to consider when implementing this feature
- Identify whether the feature is in the right phase order (does it depend on anything not yet built?)
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

Write a concise feature spec to `.tmp/specs/<feature-name>.md` (create the directory if it doesn't exist) covering:

1. **What** — one-sentence description
2. **Why** — pedagogical / product rationale
3. **Data model** — new or changed Firestore fields/collections
4. **UI flow** — screen(s) and interactions
5. **Logging** — what gets recorded and why
6. **Out of scope** — explicit exclusions to prevent scope creep
7. **Phases** — ordered implementation phases, each small enough for one sub-agent session

The Phases section is required. Break the feature into concrete, independently deliverable phases (e.g., "Phase 1: data model + Firestore writes", "Phase 2: UI list view", "Phase 3: recommendation signal integration").

### Step 5 — User Confirmation

Present the spec to the user and wait for explicit confirmation before proceeding. If the user requests changes, update the spec and confirm again.

### Step 6 — Delegate to feature-large

Once the spec is confirmed, invoke the `feature-large` agent with:

- The path to the spec file (`.tmp/specs/<feature-name>.md`)
- An explicit note that **scoping is already complete — skip grill-me**
- Instruction to use the spec's Phases section as its implementation plan (no separate PLAN.md needed)
- Instruction to check off the completed item in `PLAN.md` after all phases are verified working

The skill's job ends here. feature-large owns implementation, verification, and PLAN.md completion.
