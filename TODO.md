# TODO

> **Generated mirror — do not edit by hand.** Source of truth = [GitHub Issues](https://github.com/Senth/my-musical-repertoire/issues) + the Kanban board.
> Regenerate with `scripts/sync-todo.sh`. Last synced: 2026-06-04 16:00 UTC.

## Working On

_nothing in progress_

## Next Up

- [ ] #42 `feature` Currently metronome is stopped when the value is invalid. However, I think it should only pause when the value is invalid. For example user sets bpm to 60; starts metronome (metronome is now active); User starts editing text, pressing backspace (metronome is now invalid at 6 bpm, and stops - here I want it to enter a "paused" state instead); user types 3 (bpm is now 63 and is valid, as of now user has to press start button again - here I want it to resume entiring a "running" state).
- [ ] #41 `feature` Easy double/half BPM, plus +/-2 and +/-5 BPM buttons
- [ ] #25 `bug` Reset password page not centered

## Backlog

- [ ] #44 `cleanup` Make focused sessions have all toggles.
- [ ] #43 `cleanup` Repertoire focus should include technique and sight reading
- [ ] #40 `feature` Native Android audio via expo-av (replace current native no-op stub)
- [ ] #39 `feature` Visual beat pulse animation
- [ ] #38 `feature` Volume / mute control
- [ ] #37 `feature` Tap tempo input (tap 4-8 beats -> computed BPM)
- [ ] #36 `feature` Time signature selector (4/4, 3/4, 6/8, 2/4) with beat-1 accent
- [ ] #33 `Add renovate` 
- [ ] #32 `feature` Metronome enhancements
- [ ] #31 `cleanup` Padding/margin consistency pass (MD3 audit)
- [ ] #30 `cleanup` Visual consistency: chip weight + self-estimation bars
- [ ] #29 `cleanup` Filter UX: multi-select checkboxes, hide "Status" label
- [ ] #27 `bug` Composer autocomplete suggestions render behind other elements
- [ ] #26 `bug` Center max-width on desktop web pages that span full width
- [ ] #24 `feature` Progress tracking with charts
- [ ] #23 `feature` Practice reminders / scheduling
- [ ] #22 `feature` Mobile/Android polish + EAS build
- [ ] #21 `feature` Practice dashboard (overview + suggested blocks + rationale)
- [ ] #20 `feature` Technique curriculum: suggest when a new item is due
- [ ] #19 `feature` Section progression nudges (phase transitions + add next section)
- [ ] #18 `feature` Section BPM progression suggestions
- [ ] #17 `feature` Explain why each suggested block was chosen
- [ ] #16 `feature` Per-log "note for next time" field
- [ ] #15 `feature` Piece Album/Collection field with autocomplete
- [ ] #14 `feature` Firestore offline persistence + offline-first UX
- [ ] #13 `feature` Practice history screen
