# CLAUDE.md

My Musical Repertoire: an Expo / React Native web-first practice app on Firebase.
[Setup and scripts](README.md) · [Vision and architecture](docs/PROJECT.md) ·
[Infra, ports and deploys](docs/OPERATIONS.md) · [Personas](docs/PERSONAS.md)

- Package manager is **yarn**, not npm; imports use the `@/` alias, never `../`;
  platform splits are `.web.tsx` / `.native.tsx`.
- Reach for a **react-native-paper** component first, else a style prop built from
  `theme/tokens.ts` — no `StyleSheet.create`, and deliberately no NativeWind or Tailwind.
  Colours come from `useTheme()` — never a literal outside a theme file.
  - The app has not got there yet: 163 `className` uses across 40 files, and
    `theme/tokens.ts` arrives with the conversion in #127. The rule is still the rule —
    new code is written on the target stack, so the conversion never has to catch up
    with itself.
- Every user-facing string goes through `t()`, with `i18n/locales/en-US.json` updated in
  the same change.
- Domain modules in `utils/` and `models/` have sibling tests. Snapshot tests and
  render tests that only assert layout do not exist here; `e2e/` is the exception that
  proves it, because it drives a real browser.
- **Writes go through `awaitWrite`** (`utils/firestore-write.ts`). This app is used at a
  piano with no wifi: awaiting a raw write blocks the UI until the network returns.
- Constrain every `onSnapshot`; a listener whose breadth grows with the repertoire is a
  bug even when it works — David has sixty pieces alive at once.
- **A new user-owned Firestore collection or device storage key MUST be added to
  `utils/delete-account.ts` and to `clearLocalUserData` in `utils/session-storage.ts`**,
  children before parents. Miss one and account deletion silently leaves data behind,
  which makes the privacy policy a false statement.
- Changing `firestore.rules` means `yarn deploy:dev`. An undeployed rule is not a rule,
  and it is the usual cause of "Missing or insufficient permissions".
- Local e2e runs against the **Firebase emulators**, never the dev project. This repo
  owns ports **8050-8056**; see [OPERATIONS.md](docs/OPERATIONS.md) for which is which
  and how to boot the stack.
- After implementing: `yarn lint --write`, `yarn invariants`, `yarn typecheck`,
  `yarn test` — fix everything they report, including pre-existing failures. `yarn e2e`
  is the fifth gate, run by the review stage and by CI, and needs
  `scripts/dev-stack.sh up`. The ordered list is `[gates]` in
  [`.ai/config.toml`](.ai/config.toml), and that list is what a green report is
  measured against.
- `yarn invariants` ([`scripts/check-invariants.sh`](scripts/check-invariants.sh)) is
  where the greppable rules above are enforced. Silence a false positive with a trailing
  `// invariants:allow`, never by widening the pattern; the script drops those lines in
  `drop_allowed()`. A new rule a regex could decide goes in that script too. CI passes
  `--base`, and a named base it cannot resolve is a hard error rather than a pass.
- **The workflow is not in this repo.** The stage logic, the dispatch rules and the review
  loop live in the global agents. This repo carries `.ai/config.toml` plus the `docs/`
  addons and nothing else — there are no repo skills and no repo agents, and adding one is
  the wrong fix.
  - [`.ai/config.toml`](.ai/config.toml): the ordered gates, what counts as user-visible,
    how to boot the stack and sign in (`[dev]`), and the design contract.
  - The `docs/` addons, read when present: [`PROJECT.md`](docs/PROJECT.md) (what this is),
    [`PERSONAS.md`](docs/PERSONAS.md) (who it is for), and [`DESIGN.md`](docs/DESIGN.md)
    (how it looks).
- Work you want carried to a PR starts with the `dispatcher` agent. Work that needs more
  than one phase goes to `planner` first, in its own session, which writes
  `.tmp/<source>-PLAN.md` — untracked, and pasted onto the issue.
- Ship only on a green review — the session that wrote the code never signs it off, and
  the `ship` skill opens a **draft** PR. The merge is the human's.
- Work lives in **GitHub Issues + the Kanban board** (project 3), not markdown — labels
  `bug` / `feature` / `cleanup` / `idea` / `ai`, an `idea` moves to the Idea column,
  branches are `feat/<nn>-<slug>` · `bug/<nn>-<slug>` · `cleanup/<nn>-<slug>`, and the
  PR closes the issue with `Closes #NN`.
- Merging a PR deploys to production, so gate every merge on green CI.

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
