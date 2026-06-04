# CLAUDE.md

## Tasks & Docs

- **Tasks live in GitHub Issues + the Kanban Project board** — not in markdown. There is no
  PLAN.md. Use `gh issue list/view/create/close` and `gh project` (board: Backlog / Next Up /
  In Progress). Labels: `bug`, `feature`, `idea`, `cleanup`.
- [`TODO.md`](../TODO.md) is a **generated mirror** of the board (`## Working On / Next Up /
  Backlog`). Never hand-edit it; regenerate with `scripts/sync-todo.sh` after creating or
  closing issues. It also auto-runs on branch checkout.
- Close issues from PRs with `Closes #NN` in the PR/commit body.
- Vision, requirements, decisions, and architecture: [`docs/PROJECT.md`](../docs/PROJECT.md).
  Per-feature deep specs: [`docs/specs/`](../docs/specs/).

## Verifying changes

- After implementation done, run all tests and lint. Fix all issue (included existing ones)
- Manually test visual and interactive changes in the web app.
  - Detect worktree: if `$PWD` ends with exactly `my-musical-repertoire`, use port 8081 (main). Any other dir name means worktree → use port 8082.
  - Local server has been started by user. Main: http://localhost:8081, Worktree: http://localhost:8082.
  - Test with playwright skill.
  - Login by email and password
    - Test email: senth.wallace@gmail.com
    - Test password: hellomynameispassword123
- Visual/interactive bugs: Identify and test with playwright skill.

## Firebase

- This project uses a real Firebase dev project. No emulators are running.
- When `firestore.rules` are changed, these need to be deployed using `yarn deploy:web` to have an effect.
- When a Firestore write fails with "Missing or insufficient permissions", check whether the relevant rule was deployed, not just written to `firestore.rules`.
