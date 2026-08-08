# CLAUDE.md

## Tasks & Docs

- **Tasks live in GitHub Issues + the Kanban Project board** — not in markdown. There is no
  PLAN.md. Use `gh issue list/view/create/close` and `gh project` (board: Backlog / Next Up /
  In Progress). Labels: `bug`, `feature`, `idea`, `cleanup`.
- When starting work on an issue, move it to "In Progress".
- [`TODO.md`](../TODO.md) is a **generated mirror** of the board (`## Working On / Next Up /
Backlog`). Never hand-edit it; regenerate with `scripts/sync-todo.sh` after creating or
  closing issues. It also auto-runs on branch checkout.
- Close issues from PRs with `Closes #NN` in the PR/commit body.
- Vision, requirements, decisions, and architecture: [`docs/PROJECT.md`](../docs/PROJECT.md).
  Per-feature deep specs: [`docs/specs/`](../docs/specs/).

## Privacy Policy & Terms of Service

The copy lives in `i18n/locales/en-US.json` under `screen.privacy` and `screen.terms`, and
renders at `/privacy` and `/terms` (`app/(legal)/`). It has been legal-reviewed to 10/10 —
every sentence is deliberate, so change it by editing the JSON, never by paraphrasing.

**Before implementing any feature, check whether the policy needs updating first.** A feature
needs a policy change if it: collects a new kind of data, stores data somewhere new (a new
Firestore collection, a new device key, a third-party service), sends data anywhere, adds
analytics or crash reporting, changes how long data is kept, or changes what the user can do
with their own data. If in doubt, it needs one. The policy is written as an exhaustive
inventory — a new collection that is not listed makes the document wrong.

Things the documents currently promise, which constrain what we may ship:

- **No analytics, no trackers, no ads, no third-party scripts.** Adding any breaks a factual
  claim in `screen.privacy` and requires a policy update, not just a code change.
- **30-day email notice** to every account holder before a material change to the policy or
  terms takes effect, and before shutting the service down. So a data-affecting feature is
  not "done" when it merges — the policy update has to land, `lastUpdated` has to be bumped
  on the changed document, and the notice email has to go out *before* the feature reaches
  users. Plan that lead time in.
- **Rights requests answered within one month**, extendable by two months for complex ones.
- **No export button yet** — stated in four places. See #104; when it ships, that wording
  comes out.
- **Delete account** is real and irreversible (`utils/delete-account.ts`). Any new
  user-owned Firestore collection or device storage key MUST be added to it and to
  `clearLocalUserData` in `utils/session-storage.ts`, or deletion silently leaves data
  behind and the policy becomes a false statement.

When you do change the copy: bump `lastUpdated` on the affected document, keep the two
documents consistent with each other (they cross-reference), and re-run a legal review before
considering it done.

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
- When `firestore.rules` are changed, these need to be deployed using `yarn deploy:dev` to have an effect.
- When a Firestore write fails with "Missing or insufficient permissions", check whether the relevant rule was deployed, not just written to `firestore.rules`.
