# Index of specs

One spec per feature area, describing the behaviour as it currently ships. Specs
carry the *why* — the pedagogy and the rejected alternatives — so decisions are
not re-litigated. They are not implementation plans: while work is in flight the
plan lives in [`wip/`](wip/README.md), and `/ship` folds it in here and deletes it.

| Spec | Description | Tags |
| ---- | ----------- | ---- |
| [session-presets](session-presets.md) | User-owned, editable presets — a named list of absolute minutes per block kind — replacing fixed emphases. Per-line floors, four seeded defaults, an unsaved Custom row, and the canonical block order. | sessions, presets, planner |
| [session-planner](session-planner.md) | `buildPlan`: how an allocation becomes blocks. Availability and proportional redistribution, greedy piece-anchored learning line, stabilizing split, maintenance packing with the inflation cap and oversized-piece opt-in, technique and warmup picks, leftover handling. | sessions, planner, blocks |
| [planner-scoring](planner-scoring.md) | The one scoring module behind every ranking: the per-phase section score (days / BPM gap / needs-work), per-mode scoring, maintenance-piece and technique scores, the piece score, and the Overview suggestion lists with their reason copy. | scoring, planner, overview |
| [session-coach](session-coach.md) | Running a session: setup preview and Start, the coach shell with dual timers and Save & next, block bodies, duration prompt, pause/resume and wake lock, Overview resume banner, and the summary. | sessions, coach, ui |
| [practice-logging](practice-logging.md) | Logging a practice: hands and drill modes, `byMode` and derived values, targets and preselection, unselected ratings with the dirty save gate, BPM control, last-session reference card, sections panel, batch save path, and the per-mode comparison. | practice, logging, modes |
| [section-phases](section-phases.md) | How `section.phase` moves: the manual chip, evidence-based advance/demote nudges with their criteria and suppression, automatic run-through credit and demotion, the add-next-section nudge, and the `phaseTransitions` audit trail. | sections, phases, nudges |
| [piece-library](piece-library.md) | Managing repertoire outside a session: piece fields, composer and collection autocomplete, the piece detail screen and section rows, and list sorting, filtering, pills and search. | pieces, sections, lists |
| [pwa-support](pwa-support.md) | The installable web app: manifest and icons, hand-rolled service worker with a gated update prompt, Firestore offline persistence, wake lock, install gating, coach exit guard, and the offline bar. | platform, web, offline |
| [back-button-navigation](back-button-navigation.md) | History-first back navigation with a hierarchy or `from` fallback, the `useUpNavigation` hook, per-screen fallbacks, and the two distinct practice-screen affordances. | navigation, platform |
