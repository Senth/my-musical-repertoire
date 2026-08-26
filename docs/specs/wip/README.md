# Work in progress specs

One file per in-flight issue: `<nn>-<slug>.md`, written by `/new-feature`, `/cleanup`
or `/bug`, worked by `/implement`, and **deleted by `/ship`** once its content is folded
into the area spec next door.

Three of its sections never survive that fold — `Handoff`, `Acceptance` and `Phases`.
They are scaffolding for the implementation run: the `[test]` acceptance claims become
real `e2e/` specs, and the area spec describes the finished behaviour in the present
tense instead. **Nothing durable may live only in those three sections.**

Empty is the normal state of this directory.
