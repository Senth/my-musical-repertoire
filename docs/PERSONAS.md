# Personas

> The cast a review judges as, and the reference for anyone writing a spec, a `t()`
> string, or a reason line the app shows a student. A browser review picks the one
> persona the change most affects; a plan is checked against the whole cast.

These are a **review instrument**, not market research. Each persona exists to stress
one thing this app can plausibly fail at, and no two of them can produce the same
finding. That constraint is the point: a cast picked for variety produces six versions
of the same generic UX note.

Keep the cast at six. To cover a new risk, **replace** the persona whose risk has
become least interesting rather than adding a seventh — every extra voice costs review
length and dilutes the rest.

Margit is not a user. She is the pedagogy authority the product is built around, and
she reviews the app the way she would review a student's practice plan. Her standing
positions are at the bottom of this file; they are the closest thing this project has
to a teaching contract, and a feature that contradicts one needs an argument, not an
oversight.

Each entry carries the same eight fields. **Quits when** is the sharpest of them: it
turns "this feels a bit cluttered" into "this is the thing that makes Lena stop opening
the app."

---

### Margit, 63 — the teacher

**Plays** Everything, badly on purpose, to demonstrate. Thirty-five years of teaching,
a studio of fourteen students from grade 3 to conservatory entrance.
**Level** Professional; her judgement, not her playing, is what matters here.
**Tech** Laptop, reluctantly. Keeps her real records in a notebook and would keep
keeping them there if the app did not earn the switch.
**Repertoire** Her students'. She thinks in assignments, not in pieces.
**Opens the app to** See whether a student's week was actually spent the way the
lesson asked, and whether the app's advice matches what she would have said.
**Says** "Hands separately", "under tempo", "the seam", "what are you actually fixing
in bars 17–24?" Never "task", "item", "entry".
**Quits when** The app recommends work she would not assign — practising a piece
end-to-end when three bars are the problem, or pushing tempo on a section that is not
accurate yet. One bad recommendation costs her trust in every other one.
**Stresses** Whether a suggestion answers *why this now*, whether the phase model
(learning → stabilizing → maintenance) matches how skill actually consolidates,
whether BPM advice respects accuracy, and whether logging captures enough to justify
tomorrow's recommendation.

---

### Erik, 44 — the returner

**Plays** An upright in the hallway, RCM 6-ish, twenty years off, back for two years.
**Level** Intermediate, uneven — reads better than he plays, technique gaps he is
embarrassed about.
**Tech** Android phone, fluent enough. Will not sit at a laptop to plan practice.
**Repertoire** Four or five pieces, one of them too hard, kept because he loves it.
**Opens the app to** Use the twenty-two minutes between the kids leaving and his first
meeting, without spending four of them deciding what to do.
**Says** "I've got twenty minutes", "the hard bit", "I can nearly play it". Never
"session", "block", "allocation".
**Quits when** Setup costs more than the practice does, or the app implies he is
behind. He is already the one who quit once.
**Stresses** Time-to-first-note, whether short sessions produce a plan worth
following, whether the app is honest about a piece that is above his level, and
whether it can be used without curating anything first.

---

### Sofia, 17 — the exam student

**Plays** A grand at school, a digital at home. ABRSM grade 8 in eleven weeks.
**Level** Advanced-intermediate, working to a syllabus and a date.
**Tech** Phone and laptop, fast. Screenshots her practice log into a group chat.
**Repertoire** Three exam pieces, scales and arpeggios in every key, sight-reading she
avoids, aural she avoids more.
**Opens the app to** Find out whether she is on track, and to make the scales happen
even though she would rather play the pieces.
**Says** "Exam", "the list", "I still can't do the B-flat minor one", "how many days".
**Quits when** The plan ignores her deadline, or spends her practice on the pieces she
already enjoys and lets the scales rot. A recommendation engine that follows her
preferences is a recommendation engine that fails her exam.
**Stresses** Deadlines and pacing, the balance between technique / sight-reading /
repertoire, coverage of a fixed required set, and whether the app can be firm about
the thing the student is avoiding.

---

### David, 52 — the professional

**Plays** Two hours most days, a recital in the spring, teaching the rest of the time.
**Level** Professional.
**Repertoire** Sixty-odd pieces alive at once, most in maintenance, four being learned,
two being performance-polished.
**Tech** Whatever is nearest. Impatient with software that thinks it knows better.
**Opens the app to** Stop a maintenance piece rotting unnoticed, and to see what has
not been touched in six weeks. Not to be told what to practise.
**Says** "Under the fingers", "it's cold", "I need to bring it back up", "run-through".
**Quits when** The app scales badly with a real repertoire — a list he must scroll,
a plan that treats sixty pieces as sixty equals, or a nudge that fires forty times.
**Stresses** Volume and density at the top end, maintenance rotation and decay
modelling, the cost of logging when logging happens twenty times a session, and
whether advice can be ignored without the app fighting back.

---

### Lena, 34 — the plateaued

**Plays** Forty minutes most evenings, has for six years, and is roughly where she was
three years ago.
**Level** Intermediate and stuck.
**Repertoire** Whatever she is currently playing through, start to finish, at the only
tempo she can manage, repeatedly.
**Tech** Phone, occasional. Not curious about features.
**Opens the app to** Do what she was going to do anyway, and feel that it counted.
**Says** "I practise loads", "I just can't get that bit", "I played it three times".
Never "section", "phase", "target tempo".
**Quits when** It nags. She is doing the honest thing — showing up — and an app that
opens by telling her she is doing it wrong is an app she deletes on a bad week.
**Stresses** Whether the app can change behaviour rather than record it, whether
sectioning is discoverable to someone who has never sectioned anything, the tone of
every nudge, and whether the reason line teaches or merely justifies.

---

### Rasmus, 29 — at the piano

**Plays** In a flat with a digital piano and no wifi that reaches it. Phone in a
stand on the music desk, above the keys.
**Level** Intermediate; the level is not what he is here to test.
**Tech** Android, screen at arm's length, one hand free at most and usually none.
Practises with the phone locked out of reach or with the screen dimming.
**Repertoire** Modest and stable.
**Opens the app to** Log the thing he just played, without breaking the flow of
playing it.
**Says** Nothing. He is playing. He taps.
**Quits when** A flow needs two hands, a small target, precise scrolling, or the
network. Or when the screen sleeps mid-session and loses where he was.
**Stresses** Touch target size and reach, one-handed operation, offline writes and
what the app claims when it is offline, wake lock, interruption and resume, and
whether a logging form can be completed between two run-throughs.

---

## Margit's standing positions

The pedagogy this product is built on. A review cites these by name; a feature
that contradicts one is a finding, not a preference.

1. **Concrete blocks, never "practise this piece."** An assignment names what is being
   fixed and where.
2. **Repertoire moves through learning → stabilizing → maintenance**, and the right
   work is different in each.
3. **Practice is time-bounded, goal-oriented, and usually section-aware.** A plan that
   does not fit the time available is not a plan.
4. **Every recommendation answers "why this now?"** in one line a student can read.
   Advice a student cannot audit is advice a student stops following.
5. **Sections before scores.** Manual section labels and bar ranges beat any
   sheet-music feature for making practice targeted.
6. **Tempo is earned.** Target BPM and achieved BPM, and no tempo push on a section
   that is not accurate yet.
7. **Logging must stay cheap without going blind.** Accuracy, tempo achieved when
   relevant, effort, and scope completed. Notes optional. Lose those signals and every
   future recommendation degrades.
8. **Log after each block**, not once at the end, with an optional reflection at the
   close.
9. **Chaining is the important structural suggestion.** A → B → A+B with a seam
   exercise is what turns two learned sections into a piece.
10. **The student decides when to move on.** The app nudges; it never gates,
    auto-unlocks, or overrides.
11. **Technique is a small curriculum, rotated — not composed.** New items arrive from
    a teacher or the student, not from the app.
12. **Polish that does not improve practice quality is not a feature.** Say so.
