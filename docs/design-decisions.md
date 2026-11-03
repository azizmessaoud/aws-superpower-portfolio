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
- Human language (29 Oct): the question box tolerates typos (edit distance 1 for words of 4 to 8 letters with the right first letter, 2 from 9 letters; nothing under 4 letters) and everyday shorthand ("whois", "wat", "ur"). Recruiter-style questions (who is he, internships, languages, where based, volunteering, availability) are answered from five new profile passages whose source is my earlier portfolio; judgements and money (hire, strengths, salary) get an explicit "not verified". No language model is involved.
- Name (29 Oct): the feature is called "Terminal Explorer" everywhere visitors see it ("Ask my brain" read as informal). Older notes and audit files below keep the old name for history.
- Hero copy (29 Oct, after feedback that "Ask my brain" read like a product feature): the headline now leads with what I do ("I build practical AI systems.") and the evidence trail ("including what didn't work"); the question box stays, labelled as a way to check claims. Text in the hero is not selectable (so clicking the animation never highlights it); the question box and answers are.
- Final alignment (29 Oct): the question box moved into the hero with the brain beside it; one answer engine (`src/assistant/answer.ts`) feeds both the hero panel and the terminal. Outcomes are `supported`, `contradicted`, `not_verified`, `error`. AWS facts come only from `content/aws-status.yaml`; a config file never implies a deployment and a dependency or plan never implies a service. Visual refinement was controlled, not a rebuild: no gradient headline, flatter skill cards, no hover lift; the brain, colours and type are unchanged. Bedrock, Lambda and API Gateway are planned only.


## 31 Oct 2026: first-screen hiring path, case-study glance, failure modes

- Hero gains one availability line (2027 PFE) and two different actions: "See selected work" (#selected) and "Contact Aziz" (#contact). There is no CV button because no verified CV file exists yet (D2/D8); do not add a link to an unverified file. Both extras hide once an answer is on screen, like the intro paragraph, so the answer never clips on a 320 px phone.
- "Selected work" sits directly under the hero: three cards, each with result and caveat side by side. The same data (`projects/summary.ts`) opens each case study, so the preview and the detail cannot disagree. Ownership appears only where the evidence records it.
- Answers link to the case study they cite (derived from the sources the answer already shows). An empty question now gets the engine's own message instead of silence.
- The animation is optional: its chunk sits behind an error boundary, so a failed import no longer unmounts the page. The no-JavaScript page now carries name, availability, repository links and contact.
- Not done on purpose: no Spline/WebGL/shader, no new dependency. The existing particle scene already carries the state story.

## 1 Nov 2026: the 3D hero is integrated (WebGL), with the 2D scene as fallback and as the nav motif

- **Two canvases, never sharing a context.** The 2D scene keeps the whole page canvas and the small docked brain in the nav. The new 3D canvas is a fixed square placed in the hero's free area and moved with a CSS transform; its z-index is below the hero stage, so text is always drawn on top of the light.
- **One choreography.** The 3D canvas reads the 2D scene's own scroll progress, eased flight and dock position (`scene.getHeroState()`), flies to the nav on the same curve, and fades while the 2D scene fades its docked brain in. The flight maths is a pure, unit-tested function.
- **A "WebGL hero" mode in the 2D scene.** `heroMode: "webgl"` stops it drawing the skill sphere, labels, drifting field and old brain (the generic spherical network is gone in this mode), and eases back if the 3D hero fails. The default mode is unchanged, and its tests stay (they now run with `?hero=canvas`).
- **Capability, not pointer type.** `canUseWebglHero()` and `chooseTier()` look at WebGL2, gzip streams, Save-Data, memory, cores and window size.
- **Governor.** After the first frames the frame time is judged; one step down (device pixel ratio 1, no particles or beads), and if still slow the 3D hero is dropped for the 2D one.
- **Geometry is baked.** Generating the brain takes about 1.3 s of computation, so it is generated offline and shipped as small gzip files; the loader rebuilds triangles from counts.
- **Placement.** On a wide screen the brain sits right of the text; below the text on a phone. On the shortest phones it may tuck at most about 0.45 of its radius behind the last row (text stays on top).
- **Budgets enforced by script.** `npm run check:budget`: 3D chunk 137.1 kB of 180 kB; main bundle 76.0 kB; geometry files on the wire 406.6 kB (full) and 154.5 kB (mobile), against proposed budgets of 450 and 180 kB.
- **Not verified:** frame rate on physical GPUs and phones. Browser tests use software WebGL on a shared CPU, which is slower and noisier than real hardware.

## 2 Nov 2026: project cards, and one hover language

- **Cards, not paragraphs.** Selected work shows, per project, one figure (−19%, 0.94, 7 steps), its caption and a short caveat. The Projects section shows three cards (a small picture, kind, title, one line, tools) and opens one full case study under them. Every card line is condensed from text already in the case study (`projects/summary.ts`); the caveat stays on the card, because a result without its limit is the thing this site does not do.
- **One case study at a time.** Only the chosen case study is mounted. `#project-traffix` (from Selected work, from an answer, or typed) opens it and is kept in the address; Close returns focus to the card. Tests that read case-study internals now open each study first, and axe and overflow run over each opened study.
- **The whole card is the link.** The "Read the case study" link stretches over the card; the proof link sits above it. The stretched area is square-cornered: a pill-shaped one left the card corners dead (found by a test).
- **Hover.** Cards lift 4 px, light their border and show a soft glow that follows the pointer (`ui/spotlight.ts`, one passive listener); the nav underline slides in; buttons and chips respond. Hover-only effects sit behind `(hover: hover)`, movement behind `prefers-reduced-motion: no-preference`, so touch and reduced-motion visitors get colour feedback and no motion.
- **Not verified:** hover feel on a real mouse and trackpad; the effects are checked by computed style in a headless browser.

## 2 Nov 2026 (2): "Terminal Explorer" becomes "Ask Aziz"; answers you can read; and what it is not

- **What it is.** An evidence-retrieval assistant: keyword search with typo tolerance over 22 checked passages, plus structured answers for certifications, tools, AWS and each project's label. **It is not a language model and the site says so** ("Looked up in this site's checked evidence, not generated by a language model"; a "Looked up, not generated" chip on every answer). Calling it AI would be false, and honest evidence is the point of the site.
- **A real defect found and fixed.** "Where does FlyRank fail?" returned TraffiX's limitations, and "Who reviews the output of TraffiX?" returned a FlyRank passage. A question that names one project and one aspect (fails, data, how judged, who reviews) is now answered from that project's own label (`LABELS`, with the project's proof link), never from free retrieval. Two projects in one question, "data leakage", and questions with no aspect still use retrieval. Retrieval evaluation unchanged (hit@1 0.96, hit@3 1.00, MRR 0.978).
- **Answers you can read** (`assistant/present.ts`, pure, no new facts): a headline (the first sentence; list answers say what the list is), a short list for project answers, the rest behind "Show the rest", trust chips (sources, limits noted, looked up), a one-line callout when the question's premise is wrong, and "Ask next" follow-ups. Every follow-up is checked against the engine in tests (never an error; a project follow-up gets that project's own answer, two steps deep).
- **The command line stays**, renamed "Command line", described as the same engine, not a different assistant.
- **3D.** The brain turns about 14° toward the pointer (relative to the brain, frame-rate independent springs), leans in about 3% as the pointer comes close, wakes (brighter, faster light) and flashes on a press or tap. Nothing moves with reduced motion. A latent bug fixed on the way: switching reduced motion mid-visit dropped the page to the 2D hero, because the effect's teardown force-loses the GPU context and a second run reused the same canvas element; each run now gets its own canvas.
- **Controls.** `npm run audit:controls` measures every interactive element (target size, pointer cursor, hover response, focus ring) on desktop and phone. It found the logo and about 20 plain links with no hover; fixed. Exit code 1 if anything is flagged.
- **Not done: generative AI.** A model that writes answers needs a backend (for example Amazon Bedrock behind Lambda), credentials, cost and rate limits, and a changed answer to "Does Aziz use Bedrock?". That is decision D1 and needs Aziz's approval; until then the site claims nothing it does not do.
- **Not verified:** how the hover and 3D reaction feel on a real mouse, GPU and phone; the brain's brightness response is not measured (a pixel comparison was confounded by the animation).

## 2 Nov 2026 (3): a palette and motion that mean something (not the default "AI" look)

- **Why change it.** Navy ground, violet and cyan together, gradient brand and button, glow shadows, frosted glass, neon network dots and macOS traffic-light dots on the terminal are the stock look of generated AI landing pages. They said nothing about the work.
- **The palette** (`styles/tokens.css`): warm graphite ground, bone text, and **one** accent, verdigris (aged copper). Colour carries meaning: verdigris = interactive or evidence; amber = a limit or caveat; brick = an error; stone (dashed) = not verified. No gradients, no coloured glows. All 73 contrast pairs pass (lowest 5.5:1). Tokens are named by role (`--accent`, `--accent-text`), not by hue. The 3D fibres run copper at the root to verdigris at the tips, so colour shows the direction of flow. `tests/unit/palette.test.ts` keeps the old hues and any gradient or glow from creeping back.
- **Motion that carries data.** The Selected work cards draw two bars on a true zero baseline (TraffiX 116.3 s against 144.1 s; FlyRank 0.94 against 0.76): the baseline first, then the result, once, when the card is reached. The FlyRank picture fills to its 47 of 50; the HR steps light in order. With reduced motion, or without script, they are drawn finished. Removed because they said nothing: the pointer-following glow, the hover ripple, the traffic-light dots.
- **Found on the way.** (1) The 2D scene measured the text area with a Range, which includes clipped overflow, so a scrolling row of chips pushed the brain out of its column while an answer was shown; each block is now clamped to its own box. (2) Selected work had no side padding on phones. (3) Two baseline tests were flaky (the original code fails the pulse test 2 of 12): both are now deterministic, the pulse test also fixed to click a control that is inside the hero.
- **Not verified:** that the palette reads as "mine" (a taste call, one commit to revert); real-GPU feel; the brain's brightness response.

## 3 Nov 2026: the brain's flight follows your scroll, and you can turn it

- **What was wrong (measured).** The flight was a timed animation (0.75 s) launched by a scroll threshold at 85 % of the pinned section. Driven with real wheel input: the brain sat still for 75 % of the scroll and then travelled within a 46 px sliver of it; it moved on 17 frames while the scroll had not changed (up to 108 px in one frame); the largest single-frame jump was 112 px; and at the same scroll position it was in a completely different place going down and coming back (up to 815 px-equivalent apart). Scrolling back looked like a debug toggle because it was one. It had no relation to what the visitor was doing.
- **The change.** The flight is scroll-linked: a pure function of progress through the pinned hero (`flightTarget`, from 20 % to 85 %, smoothstep-eased), followed by a critically-damped spring (`followFlight`, exact for any frame time, so it behaves the same at 60 fps and on a slow phone). It goes at the speed of your scroll, stops when you stop, and scrolling back retraces the path. After the same measurement: largest single-frame jump 35 px (the spring settling in a slow frame), travel spread over about 66 % of the scroll, and at rest the position going down and coming back differs by about 11 px-equivalent at most in the slow software-rendered sandbox (the unit tests prove the target is exactly reversible).
- **A bug found on the way.** The first version capped each frame's time step at 50 ms. The spring maths is exact for any step, so the cap only slowed the brain in slow motion whenever a frame took longer than that (100 to 300 ms here, and plausible on a weak phone). The cap is now 250 ms and only guards a long pause.
- **Grab and turn (pointer devices).** A press on the brain starts a drag that follows the hand (about 0.5° per pixel), keeps its momentum when let go, and eases back to rest by itself, so there is no stuck state and no reset button. Open hand over the brain, closed hand while turning. The pointer-follow tilt steps aside while you hold it. Not on touch (vertical swipes keep scrolling the page), not during the flight, not with reduced motion. Turned about 58° it still reads as a brain: both hemispheres, the fissure, the cerebellum and the stem.
- **Not verified:** how it feels on a real GPU and trackpad, and with a touch screen's momentum scrolling; the measurements are from software rendering.

## 3 Nov 2026 (2): the hero's background video, and the brain you can click

- **The video.** A 5 s clip of a nerve network, supplied by Aziz (`reference/inputs/cosmos_123539191.mp4`, 480×832 portrait). Aziz must be sure he has the right to publish it; the site claims no source for it. It is processed by `scripts/make-page-video.sh`: graded to the palette (luma only, mapped to verdigris, so the neon blue of the original does not pull the page back to the stock look), cut into a **seamless 4 s loop** (the last second is crossfaded into the first; last frame against first went from 23.4/255 apart to 3.2), no audio, MP4 and WebM at about 230 kB each, plus a 17 kB poster. Budgeted in `npm run check:budget`.
- **Where it sits.** Its own layer, `z-index` 0, pinned with the hero: behind the 3D brain (1) and the text (2), so it can never cover either. The brain's additive light glows over it. The text columns are darkened so that, over **every** frame of the loop, the dimmest hero text colour keeps at least 4.5:1 against the brightest fibre behind it (measured 5.6:1 in the worst frame; an e2e test checks every half second of the loop, and fails at 0.64:1 if the darkening is removed).
- **What it costs, and when it costs nothing.** It plays only while the hero is on screen and the tab is visible. With reduced motion, Save-Data or reduced-data it is the still poster and no video bytes are fetched. If a browser cannot play it, the poster stays. Portrait fits a phone natively and is softly cropped on a wide screen, which suits an ambient layer.
- **The brain, hover and click.** Hovering shows a label that follows the pointer ("Click to ask · drag to turn") and the brain wakes and leans in. **A click makes it fire** (many pulses racing along the fibres for about two seconds) **and puts the cursor in the question box**, so the brain is the way into the site's one interactive feature. A press that moves under 5 px and lasts under 450 ms is a click; anything more is a drag (which turns it), so the two never fight. On a phone a tap fires it but does not raise the keyboard. With reduced motion the brain is not a control at all.
- **Not verified:** how the video looks on a real wide monitor (the clip is low-resolution and is upscaled); real-device decoding cost on a weak phone.

## 3 Nov 2026 (3): the background video is the whole page's, not the hero's

- **Why.** Aziz asked for it on every section, not only the header. The first version was pinned inside the hero.
- **How.** One fixed layer (`.page-bg`, `z-index: -1`) rendered once in `App`, behind everything; the hero keeps its own darkening layer (`.hero-scrim`) so its text column stays clean and the right side stays open behind the brain. Each section's ground became translucent (`--bg-a`, `--surface-a`, `--surface-v-a`, `--bg-deep-a`, about 0.86 to 0.88), so the video shows through at about 14%; cards stay opaque and are unchanged. The footer had its own opaque ground declared twice, the later one winning; the test that checks every ground found it.
- **The limit is the dimmest text, not taste.** Over every section and every part of the loop, the brightest fibre behind any content still gives the dimmest text colour (`--fg-muted`, stone) at least 4.98:1 on desktop and 5.13:1 on a phone (needs 4.5:1). That leaves little room: more visible video would need lighter secondary text. The e2e test measures all ten regions across the loop, and reports 2.29:1 per section if the grounds are thinned to 0.55.
- **Names.** `hero-bg` became `page-bg` everywhere (files, classes, script, budget), because it no longer belongs to the hero.
- **Not verified:** the cost of a fixed, always-playing video under scrolling translucent sections on a weak phone or laptop GPU (software rendering here can't tell); scroll smoothness there is the thing to check on real hardware.
