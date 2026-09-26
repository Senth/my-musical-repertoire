# Operations

> Infrastructure, local stacks, the review fixture, and deploys.
> Rules for writing code live in [`CLAUDE.md`](../CLAUDE.md);
> vision and architecture in [`PROJECT.md`](PROJECT.md).

## Two stacks, and why

| Stack | Web port | Backend | Started by | Used for |
| --- | --- | --- | --- | --- |
| Hand-driven dev | 8053 (main) · 8054 (worktree) | real `my-musical-repertoire-dev` | you | day-to-day development, hand-driven `playwright-cli` checks |
| e2e | 8055 (main) · 8056 (worktree) | Firebase emulators | `scripts/dev-stack.sh` | `yarn e2e`, the browser review, CI |

They exist separately so a test run cannot disturb the app you are looking at, and
so `yarn e2e` never writes into the dev project. The port pairs follow the same
rule: **main checkout takes the lower number, a worktree the higher**, decided from
the directory name.

This project owns **8050-8056** outright. The sibling `home-backlog` owns 8060-8064
and 8081, so neither repo's stack can ever take a port the other is using — which
matters because both are Expo web apps and Expo's own default is 8081.

Hand-driven checks — the `playwright-cli` skill, or just looking at something —
run against the dev project on 8053, signed in as **senth.wallace@gmail.com** with
the password **hellomynameispassword123**. That is a throwaway dev-project account
and nothing else. `yarn web` pins the port for you.

`config/firebase.ts` connects to the emulators only when
`EXPO_PUBLIC_USE_EMULATORS=1`, and only `scripts/dev-stack.sh` sets it. Nothing
reads it from a `.env` file, which is what keeps an emulator connection from ever
reaching production by accident.

## The e2e stack

```bash
scripts/dev-stack.sh up      # emulators + an emulator-backed web server
yarn e2e                     # the suite
scripts/dev-stack.sh down    # stops only what it started
```

`up` is idempotent: it reuses a suite that is already listening rather than
failing, and the emulators always boot **empty** — the fixture is written
programmatically at the start of every run, so there is no committed export to
import. Only the throwaway accounts of earlier runs linger on a reused suite,
never a dirty fixture.

Emulator ports come from `firebase.json` (`8050` UI, `8051` auth, `8052`
Firestore), which has no env interpolation, so **every checkout shares one
emulator suite**. Two checkouts running e2e simultaneously share throwaway data.
That is an accepted trade: reviews rarely overlap, and the seed is the thing
that makes a run deterministic.

Services are started with `setsid` so `down` can signal the whole process group.
Signalling the `yarn` wrapper alone leaves the `node` process it spawned holding
the port, which then reads as "reused" on the next `up`.

## The review fixture

There is no committed fixture export. **The e2e suite seeds the emulator
itself**: `e2e/seed.setup.ts` runs as the first Playwright project of every
`yarn e2e` (`seed` in `playwright.config.ts`), before any spec. It creates
**pianist@example.com** in the Auth emulator under a fixed uid, wipes whatever
a previous run left on that account, and writes the repertoire below through
the emulator with the app's own Firebase SDK, signed in as the fixture user so
the Firestore rules are enforced exactly as they are for the app.

The fixture must stay honest about the shapes the app actually writes —
hand-invented document shapes drift, and the first thing to notice is a test
asserting a field the app stopped writing months ago. The seed mirrors the add
flows field for field (`useAddPiece`, `useAddSection`, `useAddTechnique`), and
when a warm fixture arrives its practice logs mirror `savePractice`.

It holds one account — **pianist@example.com** — and a small repertoire chosen to
exercise the screens rather than to look realistic:

| | |
| --- | --- |
| Nocturne in E-flat major (Chopin) | learning, two learning sections |
| Invention No. 1 in C major (Bach) | stabilizing, one stabilizing + one learning section |
| Für Elise (Beethoven) | maintenance, one maintenance section |
| Gymnopédie No. 1 (Satie) | learning, **no sections** — the add-section nudge and the empty state need one |
| C major scale, two octaves · Hanon No. 1 | active and maintenance techniques |

**It deliberately contains no practice logs.** Every piece is "never practised", so
the scoring and planner screens render their cold-start paths and nothing else.
When a review needs a warm history, that is a dated practice log written by
`e2e/seed.setup.ts` — dates are computed at run time, which is the whole point
of the programmatic seed — not a hand-edited document.

Because the ids are fixed constants (`SEED_IDS` in `e2e/support/app.ts`), a
rewritten seed overwrites the same documents instead of minting new ones, and
the routes in that file keep pointing at the same pieces. The fixed uid keeps
saved Playwright storage states (`.tmp/e2e/auth.json`) valid across an emulator
restart.

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
