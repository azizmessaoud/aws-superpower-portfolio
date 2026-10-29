# Design decisions

**Revision 1 · 28 Oct 2026.** Each decision names the reference behind it so it can be argued with.

## Kept from the existing work

| Kept | Why | Source |
|---|---|---|
| Dark navy grounds, glass cards, the violet → cyan → blue gradient, Space Grotesk / Inter / JetBrains Mono | They are the established identity; the brief says continue, not replace | Prototype `:root`; AzizM design system |
| `#8b5cf6` violet | Brand mark for rules, borders, carets, timeline dots | Prototype; `violet` token note (lines and fills only) |
| The brain inside a skill sphere | It is the "soul" of the live portfolio's hero | `projectx0` main `client/src/components/NeuralField.tsx` |
| Pinned hero with a scroll-driven camera, pause button, mobile menu | Built and tested in the previous prototype pass | `scratchpad/site/index.html` (this session) |

## Changed, with reasons

| Change | Reason |
|---|---|
| Violet **text** uses `#a78bfa` (`--violet-light`) | `#8b5cf6` measures 4.19:1 on `--bg` and 3.93:1 on `--surface` (`reports/logs/contrast.txt`); text needs 4.5:1 |
| Primary button gradient ends at `#2563eb` | White on the prototype's `#3b82f6` end measured 3.68:1; on `#2563eb` it is 5.17:1 |
| Terminal dropped | The official idea list already suggests "a command line visitors type into"; my spec drops it; it would compete with the signature feature |
| Headline "Ask my brain what I've built." | Names the creative feature in the first viewport, so the hint is the headline itself; the prototype's "that actually ship" is on the deny-list |
| No stat tiles | Hero-metric templates invite arbitrary numbers; each number now sits inside its project with its definition and limits |
| Three different project layouts | TraffiX = control hierarchy + results table with the slower ambulance; FlyRank = two 50-cell ranking queues (47 vs 38 hits = 0.94 vs 0.76); HR = pipeline with outcome notes. Content decides the shape |
| Skills split into "used in the projects below" vs "also in my toolkit" | Ties each tool to evidence instead of levels or percentages |
| Emoji icons replaced by stroke SVGs in the prototype's own style | Emoji render inconsistently and read as decoration |

## Motion

- **One authored sequence:** on open the camera pulls back from the brain to reveal the skill sphere (≈1.8 s); while the hero is pinned (60 svh), scroll dollies back into the brain. Reference: Maze notes 05 and 06 ("animation effect to world", "the motion effect from start to down").
- **Supporting motion only where it explains state:** result cards rise 8 px once; nav underline marks the current section; buttons press to 0.97 for 100 ms.
- **CSS transitions, no Motion library.** The spec asked to compare: everything here is opacity/transform on known elements, so Motion's ~30 kB buys nothing yet.
- **Canvas 2D, not WebGL:** ≈1,400 brain points and 64 nodes draw well inside a 60 fps budget, and 2D is simpler to test and pause.
- **Whole page (29 Oct):** one fixed canvas. At the end of the pinned scroll (80 svh) the brain shrinks and flies into the nav's "Ask my brain" link, which shows an empty ring until it arrives. Rejected first try: a floating bottom-right dock, because on phones it covered body text.
- **Controls:** Pause/Play lives in the nav, so it is reachable on every screen (WCAG 2.2.2); remembered across reloads; nothing resumes it except the visitor. The loop runs only while the hero moves or the docked brain is hovered/focused; it stops in hidden tabs. Reduced motion: no pin, no intro, still frames that follow the scroll, no pause button (nothing moves).
- **Clear text:** the scene measures the headline, lead, buttons and hint every resize and never draws brain dots, nodes or labels inside them, nor behind the pause button.

## Retrieval

- **Own BM25 (≈80 lines) over MiniSearch:** full control of the "matched on" explanation; deterministic ties; unit-tested.
- **No embeddings yet.** Gate D6: only if a measured gain of MRR +0.10 holds with no question leaving the top 3. Keyword MRR is already 0.964 on 15 questions, so embeddings cannot meet that gate on the current set; a larger, independently written set is needed first (`reports/retrieval-keyword.json`).
- **Abstain rather than guess:** below a score floor the feature says no verified passage answers the question.

## Not yet decided (needs you)

- D8: which CV to link, if any (the live site links the September CV, which shows your phone number and the unresolved 0.24 → 0.74 claim).
- Whether to connect retrieval results to node highlighting in the scene (gated until you approve the baseline).
