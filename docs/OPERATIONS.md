# Operations

> Infrastructure, local stacks, the review fixture, and deploys.
> Rules for writing code live in [`.claude/CLAUDE.md`](../.claude/CLAUDE.md);
> vision and architecture in [`PROJECT.md`](PROJECT.md).

## Two stacks, and why

| Stack | Web port | Backend | Started by | Used for |
| --- | --- | --- | --- | --- |
| Hand-driven dev | 8053 (main) · 8054 (worktree) | real `my-musical-repertoire-dev` | you | day-to-day development, hand-driven `playwright-cli` checks |
| e2e | 8055 (main) · 8056 (worktree) | Firebase emulators | `scripts/dev-stack.sh` | `yarn e2e`, the `/review` browser pass, CI |

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
failing, and reports whether the emulators came up **pristine** from
`.emulator-seed/` or are carrying whatever a previous run left behind. Say which in
a review report — a run against dirty data proves less than it looks like it does.

Emulator ports come from `firebase.json` (`8050` UI, `8051` auth, `8052`
Firestore), which has no env interpolation, so **every checkout shares one
emulator suite**. Two checkouts running e2e simultaneously share throwaway data.
That is an accepted trade: reviews rarely overlap, and the fixture is the thing
that makes a run deterministic.

Services are started with `setsid` so `down` can signal the whole process group.
Signalling the `yarn` wrapper alone leaves the `node` process it spawned holding
the port, which then reads as "reused" on the next `up`.

## The review fixture

`.emulator-seed/` is committed, and it is **produced by the app**, never
hand-written — hand-written fixture data drifts from the shapes the app actually
writes, and the first thing to notice is a test asserting a field the app stopped
writing months ago.

```bash
scripts/dev-stack.sh down && rm -rf .emulator-seed
scripts/dev-stack.sh up          # empty emulators
yarn fixture                     # drives the app, e2e/fixture.setup.ts
yarn emulators:export            # writes .emulator-seed/
```

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
When a review needs a warm history, that is the next thing the fixture should grow
— extend `e2e/fixture.setup.ts` and regenerate, rather than editing the export.

Two traps, both learned the hard way:

- `--import` refuses to create a missing directory. `scripts/dev-stack.sh` starts
  empty and warns rather than failing outright, but the suite will be wrong until
  you regenerate.
- `biome.json` excludes `.emulator-seed/**`. Without that, `yarn lint --write`
  pretty-prints the export and the next export minifies it back, forever.

The fixture is a contract with `e2e/support/app.ts`: `SEED_USER`, the `ROUTES`
readiness markers, and every title a spec waits on. **Regenerating it means
re-running `yarn e2e` and updating those.** A stale fixture is a `blocking` finding
against whichever change broke it.

## What the craft sweep covers

`e2e/craft.spec.ts` walks every route in `ROUTES` (`e2e/support/app.ts`) and asserts
the cross-cutting things a person would otherwise re-check by eye every review: no
untranslated `t()` key on screen, no horizontal overflow, a clean console against a
closed allow list, and WCAG AA contrast in both colour schemes.

Everything it measures is **off-limits to `browser-review`**, which exists to judge
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

CI runs the same list on every PR, emulators included — in a different order:
typecheck runs **after** `build:web`, because `expo-env.d.ts` is generated by the
Expo CLI and gitignored, and without it every `import "./global.css"` is an
unresolved module.

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
