# Operations

> Infrastructure, local stacks, the review fixture, and deploys.
> Rules for writing code live in [`CLAUDE.md`](../CLAUDE.md);
> vision and architecture in [`PROJECT.md`](PROJECT.md).

## Two stacks, and why

| Stack | Web port | Backend | Started by | Used for |
| --- | --- | --- | --- | --- |
| Hand-driven dev | `scripts/dev-stack.sh dev-port` | real `my-musical-repertoire-dev` | `yarn web` | day-to-day development, hand-driven `playwright-cli` checks |
| e2e | `scripts/dev-stack.sh ports` | this checkout's Firebase emulators | `scripts/dev-stack.sh up` | `yarn e2e`, the browser review, CI |

They exist separately so a test run cannot disturb the app you are looking at, and
so `yarn e2e` never writes into the dev project. Every checkout claims its own ports
in **7000-7999** from the machine-wide registry at `~/.local/state/dev-ports/`.
`scripts/dev-ports.ts` checks both the registry and listening sockets before claiming
a port. Main checkouts, worktrees and other repos use the same allocation rules.
Never assume a port.

For hand-driven checks with `playwright-cli`, start `yarn web`, then read
`scripts/dev-stack.sh dev-port` for the dev-project web port. Sign in as **senth.wallace@gmail.com** with
the password **hellomynameispassword123**. That is a throwaway dev-project account
and nothing else. `yarn web` claims a separate `dev-web` port and clears emulator
environment variables before starting Expo. Stop it with Ctrl-C.

`config/firebase.ts` connects to the emulators only when
`EXPO_PUBLIC_USE_EMULATORS=1`, and only `scripts/dev-stack.sh` sets it. Nothing
reads it from a `.env` file, which is what keeps an emulator connection from ever
reaching production by accident.

## The e2e stack

```bash
scripts/dev-stack.sh up      # emulators + an emulator-backed web server
yarn e2e                     # the suite
scripts/dev-stack.sh down    # stops this checkout's web server and emulators
```

`up` is idempotent: it reuses this checkout's running stack. Fresh emulators boot
**empty**. The fixture is written programmatically at the start of every run, so
there is no committed export to import.

Each checkout has its own emulator suite running its own `firestore.rules` and
indexes. `up` claims ports for `web`, `auth`, `firestore`, `hub` and `logging`, then
writes the runtime Firebase config to `.tmp/dev-stack/firebase.json`. The emulator
UI is disabled. Stack ports and process identities live in
`.tmp/dev-stack/stack.json`.

`scripts/dev-stack.sh ports` prints the running e2e web port.
`scripts/dev-stack.sh env` prints the web and emulator ports plus the fixture email;
`playwright.config.ts` reads it before every run. Start the stack first, even when
running Playwright directly. `scripts/dev-stack.sh status` lists each stack service's
port and process state. `up --no-web` starts only the emulators.

`down` stops only this checkout's recorded web and emulator process groups and
frees their claims. It does not stop another checkout's stack or the separate
`yarn web` process. When the dispatcher finishes every step, it runs the `[dev] stop`
command in `.ai/config.toml`.

Services are started with `setsid` so `down` can signal the whole process group.
Signalling the `yarn` wrapper alone leaves the `node` process it spawned holding
the port, which then reads as "reused" on the next `up`.

## The review fixture

There is no committed fixture export. **The e2e suite seeds the emulator
itself**: `e2e/seed.setup.ts` runs as the first Playwright project of every
`yarn e2e` (`seed` in `playwright.config.ts`), before any spec. It creates the
email from `scripts/dev-stack.sh fixture` in the Auth emulator under a
checkout-specific fixed uid, wipes whatever a previous run left on that
account, and writes the repertoire below through the emulator with the app's
own Firebase SDK, signed in as the fixture user so the Firestore rules are
enforced exactly as they are for the app. `up` prints the same address as
`SEED_EMAIL=`.

The fixture must stay honest about the shapes the app actually writes —
hand-invented document shapes drift, and the first thing to notice is a test
asserting a field the app stopped writing months ago. The seed mirrors the add
flows field for field (`useAddPiece`, `useAddSection`, `useAddTechnique`). Practice
logs and their parent summary fields mirror `savePractice`, `saveSectionPractice`
and `saveTechniqueLog`, including one shared timestamp per multi-mode save.

Each checkout has one account, named by `scripts/dev-stack.sh fixture`, and a
small repertoire chosen to exercise the screens rather than to look realistic:

| | |
| --- | --- |
| Nocturne in E-flat major (Chopin) | learning, two learning sections, no practice history |
| Invention No. 1 in C major (Bach) | stabilizing, Exposition LH/RH/HT two days ago, Middle entries HT yesterday, run-through today flagging Middle entries |
| Für Elise (Beethoven) | maintenance, one maintenance section, no practice history |
| Gymnopédie No. 1 (Satie) | learning, **no sections**, no practice history. The add-section nudge and the empty state need one |
| C major scale, two octaves | active, staccato enabled, plain LH/RH and staccato LH/RH in one save yesterday |
| Hanon No. 1 | maintenance, no practice history |

**The fixture carries both warm history and cold-start paths.** Invention No. 1
has three saves across three practice days; C major scale has one four-mode save.
Dates are computed at run time by `e2e/seed.setup.ts`, not frozen in an export.
Practice logs contain no notes. Invention stays stabilizing, so its run-through
earns no section-credit logs or demotions: those apply only to maintenance sections
of maintenance or performance pieces. Nocturne, Für Elise and Gymnopédie remain
"never practised" for cold-start ranking and empty-history review.

Because the ids are fixed constants (`SEED_IDS` in `e2e/support/app.ts`), a
rewritten seed overwrites the same documents instead of minting new ones, and
the routes in that file keep pointing at the same pieces. The per-checkout uid
keeps saved Playwright storage states (`.tmp/e2e/auth.json`) valid across an
emulator restart.

The fixture is a contract with `e2e/support/app.ts`: `SEED_USER`, `SEED_IDS`,
the `ROUTES` readiness markers, and every title a spec waits on. Changing the
seed means re-running `yarn e2e` and updating those. A stale fixture is a
`blocking` finding against whichever change broke it.

**One spec opts out.** `e2e/overview-suggestions.spec.ts` runs in its own Playwright
project on a throwaway account registered fresh each run by
`overview-suggestions.setup.ts` — it creates pieces and logs practice it never
cleans up, which would leave `SEED_USER` dirty and make a second run behave
differently. It also runs with `retries: 0`, because each test leaves the account
changed for the next and a retry cannot reproduce its own precondition.

## What the craft sweep covers

`e2e/craft.spec.ts` walks every route in `ROUTES` (`e2e/support/app.ts`) and asserts
the cross-cutting things a person would otherwise re-check by eye every review: no
untranslated `t()` key on screen, no horizontal overflow, a clean console against a
closed allow list, and WCAG AA contrast in both colour schemes.

Everything it measures is **off-limits to the browser review**, which exists to judge
what a machine cannot.

**Touch targets are the deliberate omission.** react-native-paper's controls all
render below MD3's 48dp, so the assertion failed on every route, and lowering the
threshold to whatever Paper happens to render would have gated nothing. That is a
design decision, tracked in #113; the assertion goes back in at the real number once
it is made.

Two escape hatches, both principled rather than convenient:

- `aria-hidden` on decorative content excludes it from the contrast audit — WCAG does
  not hold decoration to text contrast, and this is the honest way to say "decorative"
  instead of silencing a finding.
- The console allow list in `e2e/support/app.ts` is a **closed set**, currently three
  react-native-web deprecations raised from inside Paper and Reanimated. Adding an
  entry is a decision, not a reflex.

## Gates

```bash
yarn lint --write && yarn invariants && yarn typecheck && yarn test
scripts/dev-stack.sh up && yarn e2e
```

`yarn invariants` ([`scripts/check-invariants.sh`](../scripts/check-invariants.sh))
enforces the greppable rules in `CLAUDE.md`. A false positive is silenced with a
trailing `// invariants:allow` on the offending line — never by widening the
pattern, which stops it catching the real thing. A new rule a regex could decide
belongs in that script.

CI runs the same list on every PR, emulators included.
CI fails on a flaky test; local runs report it.

`types.d.ts` exists for that: it repeats the `expo/types` reference that
`expo-env.d.ts` carries, because the Expo CLI generates that file and gitignores
it. It is present on a developer's machine and absent in CI, where `tsc` would
otherwise miss the Expo router types in a file nobody touched.

## Firebase projects and deploys

`.firebaserc` has two: `default` → `my-musical-repertoire-dev`, `production` →
`my-musical-repertoire`.

- **Firestore rules and indexes** are deployed by hand: `yarn deploy:dev`. A rule
  written but not deployed is a rule that does not exist — a write failing with
  "Missing or insufficient permissions" is usually this, not a bug in the rule.
- **Hosting** deploys from CI on every push to `main`
  (`.github/workflows/deploy.yml`). **Merging a PR deploys to production**, so
  merge on green CI and not before.

PRs are opened as drafts. Marking one ready and merging it is a human decision.
