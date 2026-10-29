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
| Terminal dropped (28 Oct) → **restored on Aziz's request (29 Oct)** | Restored as a *second way into the same evidence*: `ask` uses the Ask my brain retriever; `project`/`limits` print verified numbers with their limits and links. No invented output, no `sudo hire`, neutral prompt, Tab never captured. Kept secondary: Ask my brain stays the headline feature and the nav hint |
| Headline "Ask my brain what I've built." | Names the creative feature in the first viewport, so the hint is the headline itself; the prototype's "that actually ship" is on the deny-list |
| No stat tiles | Hero-metric templates invite arbitrary numbers; each number now sits inside its project with its definition and limits |
| Three different project layouts | TraffiX = control hierarchy + results table with the slower ambulance; FlyRank = two 50-cell ranking queues (47 vs 38 hits = 0.94 vs 0.76); HR = pipeline with outcome notes. Content decides the shape |
| Tech Superpowers in the prototype's card view (29 Oct) | Same glass cards, cyan titles and highlighted chips, but six evidenced domains, each ending in an "Used in …" link, plus a dashed "Also in my toolkit" card. Prototype chips with no source (YOLOv8, DeepSORT, PySpark, Airflow, MLflow…) dropped; team ownership respected (TraffiX React UI and DuckDB/Parquet belonged to other pairs) |
| Emoji icons replaced by stroke SVGs in the prototype's own style | Emoji render inconsistently and read as decoration |

## Motion

- **One authored sequence:** on open the camera pulls back from the brain to reveal the skill sphere (≈1.8 s); while the hero is pinned (60 svh), scroll dollies back into the brain. Reference: Maze notes 05 and 06 ("animation effect to world", "the motion effect from start to down").
- **Supporting motion only where it explains state:** result cards rise 8 px once; nav underline marks the current section; buttons press to 0.97 for 100 ms.
- **CSS transitions, no Motion library.** The spec asked to compare: everything here is opacity/transform on known elements, so Motion's ~30 kB buys nothing yet.
- **Canvas 2D, not WebGL:** ≈1,400 brain points and 64 nodes draw well inside a 60 fps budget, and 2D is simpler to test and pause.
- **Full intro background (29 Oct):** a drifting neural field (the prototype's nodes and links, token colours) fills the whole hero behind the brain sphere; fades to about a third behind each line of text (feathered over 28 px around the actual lines, not a box around the whole column), so the network reads as one continuous field; fades as the brain travels to the nav; moves only in animation frames.
- **Whole page (29 Oct):** one fixed canvas. Past 85 % of the pinned scroll (70 svh) the brain shrinks and flies, in a fixed 0.75 s that always finishes, into the nav's "Ask my brain" link, which shows an empty ring until it arrives. Rejected first try: a floating bottom-right dock, because on phones it covered body text.
- **Controls:** Pause/Play lives in the nav, so it is reachable on every screen (WCAG 2.2.2); remembered across reloads; nothing resumes it except the visitor. The loop runs only while the hero moves or the docked brain is hovered/focused; it stops in hidden tabs. Reduced motion: no pin, no intro, still frames that follow the scroll, no pause button (nothing moves).
- **Clear text:** the scene measures the headline, lead, buttons and hint every resize line by line and never draws brain dots or labels on those lines (sphere nodes fade to a fifth there), nor behind the pause button.

## Retrieval

- **Own BM25 (≈80 lines) over MiniSearch:** full control of the "matched on" explanation; deterministic ties; unit-tested.
- **No embeddings yet.** Gate D6: only if a measured gain of MRR +0.10 holds with no question leaving the top 3. Keyword MRR is already 0.964 on 15 questions, so embeddings cannot meet that gate on the current set; a larger, independently written set is needed first (`reports/retrieval-keyword.json`).
- **Abstain rather than guess:** below a score floor the feature says no verified passage answers the question.

## Not yet decided (needs you)

- D8: which CV to link, if any (the CV linked from the old site has open evidence questions; to be settled before any link is added).
- Whether to connect retrieval results to node highlighting in the scene (gated until you approve the baseline).

## 29 Oct (later): one feature, not two
- Aziz asked to remove the separate "Ask my brain" form because the Terminal Explorer does the same job. The `ask` command now carries the feature name; the hero button, the hero hint and the nav "Ask my brain" link (where the brain docks) all go to `#terminal`. Same retriever, same 16 passages.
- Added a Certifications section (5 main credentials + 11 shorter courses) and, from the main portfolio, volunteering/clubs and three smaller projects. Wording and links are copied from https://azizmessaoud.github.io/projectx0/ (read 29 Oct); not yet re-checked at the issuers. FlyRank dates stay withheld (D2) and the CV link stays out (D8).
- Not carried over: the Vital Laboratories avatar project (NDA, no public evidence to link) and the "How I work" steps.
- Retrieval card replaced (29 Oct): "Retrieval & evaluation / this site" was self-referential, so it now reads "Retrieval & LLM apps" and links to the team RAG assistant (owner: EyaLaourine, pinned to 229191a). Role wording is Aziz's own account ("worked on the RAG component"); the repo lists no contributors. Chips come from that repo's README stack section.
- Pause button removed (29 Oct, Aziz's request). Still true: reduced-motion visitors get still frames, the loop stops when the hero is off screen, and the brain docks and goes idle. No longer true: a visitor who allows motion can't stop the hero animation (WCAG 2.2.2 "Pause, Stop, Hide" asks for that on motion lasting over 5 s). Note this in `docs/accessibility-audit.md` before submission. `scene.pause()` still exists in the code, unused.
- Portrait added to About (copied from the old portfolio's `portrait.jpg`, resized to 480 px, 35 KB). Certifications and smaller projects now live in `content/*.yaml`; see `docs/ADDING-CONTENT.md`. The "AWS Certified" deny-list rule now applies to prose only, so a real certification entry (with its verification link) can be added.
