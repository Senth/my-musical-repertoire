# CLAUDE.md

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
