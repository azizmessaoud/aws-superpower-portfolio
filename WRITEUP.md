# Ask Aziz: a portfolio that shows its work (draft for the Builder Center "Your project" entry)

> Status 6 Nov 2026: built and tested locally; code public on GitHub; **hosted with AWS Amplify Hosting** (address checked 2026-11-06). The Amplify console build ID and screenshot are **not captured**, and this write-up does not claim them. Only AWS services that were actually used are listed.

**Live site:** https://main.d3j3qw8xj45viu.amplifyapp.com/ (AWS Amplify Hosting, Region `eu-north-1`; address checked 2026-11-06: HTTP 200, the page rendered in a real browser). Amplify build ID and console screenshot: not captured.
**GitHub:** https://github.com/azizmessaoud/aws-superpower-portfolio

## Problem

Portfolios often make big claims and leave the reader to trust them. An early prototype of this site did, and when I checked it against my repositories, several of its numbers and claims did not hold, so I dropped them. I wanted a portfolio where a reader can check every claim in a few seconds, including the parts that went badly.

## Idea

**Ask Aziz** is a question box in the first screen. You ask about my projects or my AWS context in your own words. It answers only from verified passages, and each answer has three parts: the answer, the evidence (the exact file and commit it came from), and the limitations. It keeps four outcomes apart:

- **Answer**: the evidence supports it.
- **The evidence disagrees**: the evidence says the opposite of the question's premise ("Did TraffiX make ambulances faster?" gets 240.0 s against 213.2 s with actuated signals).
- **Not verified**: nothing here proves it either way ("Does Aziz use Bedrock?").
- **Could not answer**: the question was empty or too long.

It retrieves; it does not write answers or judge anyone.

## Why the mind animation reflects the project

The point-cloud brain beside the question box is the interface's state, nothing else: idle, listening while you type, retrieving evidence, answering, uncertain (amber, calmer) or error. It never shows what a model "thinks" and it carries no confidence value. The same state is written as a line of text under the box, so it is readable without the animation and in reduced-motion mode. The brain is a picture of the honest part of the project: when the evidence is missing, it goes quiet instead of looking busy.

## The hero brain: a network of light, not a model of a brain

The brain in the hero is built entirely from fibres. There is no solid surface and no downloaded 3D model: my code generates a procedural cortex (two hemispheres, folds, cerebellum, brainstem), then grows a branching network over it as a river network. Fibres follow the crowns of the folds, merge into thick trunks and thin out to twigs, and a few light pulses travel along marked paths. The solid brain is used only as an invisible depth mask, so near strands hide far ones. The geometry is generated once, offline, and shipped as two small gzip files (full about 407 kB, mobile about 155 kB) that load lazily after the page; the page does not generate it on the visitor's device. If WebGL, the file or the frame rate is not good enough, the page keeps the 2D hero it had before.

## Architecture

```
browser only (static site)
  content/*.yaml  --npm run build (validate, generate data)-->  src/generated/*.json
  question --> src/assistant/answer.ts (intent routing + BM25 retriever over 23 passages, with typo tolerance)
           --> Answer { outcome, answer, evidence[], limitations[] }
           --> hero panel and terminal (same engine), mind state --> Canvas scene

hosting: GitHub (main) --> AWS Amplify Hosting build (npm ci, npm run build) --> serve dist/
```

- No backend, no model, no network call while answering. `content/aws-status.yaml` is the one place AWS facts live; the build fails if it claims a deployment without a URL and an endpoint check, or a service without evidence.
- **AWS services actually used: AWS Amplify Hosting only** (console GitHub connection, branch `main`, set up by me following the Day 4 guide). Planned and not built: Amazon API Gateway, AWS Lambda, Amazon Bedrock, S3 or Bedrock Knowledge Bases. If a backend is added later, the browser retriever stays as the fallback. I do not claim an AWS Budgets alert or billing alarm: there is no evidence of one in this repository.

## What worked

- Treating content as data with a validator: it caught a mismatched source anchor and a withheld metric quoted in a comment on its first run, and it now also guards the AWS claims (checked by editing the files to break each rule, then restoring them).
- Separating "contradicted" from "not verified". My own test showed the difference matters: "Is TraffiX deployed in Tunis?" is a no (it is a simulation), "Does Aziz use Bedrock?" is "not verified".
- Local checks, re-run on 6 Nov 2026 unless the row says otherwise, with logs in `reports/logs/`:

| Check | Result | Log |
|---|---|---|
| Vitest (answer engine, typos and recruiter questions, mind state, retrieval, terminal, 3D geometry) | 23 files, 322 tests passed. On this machine (about 2 to 4 GB of 16 GB free) 2 of 5 runs had a test worker run out of memory and did not finish; the other 3 runs passed. | `vitest.txt` |
| Playwright at 1280 and 390 px, incl. axe-core and the demo flow | Latest full run (one worker, 30.8 min): 184 passed, 23 skipped by design, 3 failed. Run alone, the axe-core test passed 2 of 2 and the FlyRank data-motion test passed; the axe failure was 2 colour-contrast nodes in the busy run and the FlyRank one was a Windows `ERR_NO_BUFFER_SPACE` network error, so I treat both as load flakes. The third, "3D hero: the flight to the nav follows the scroll...", is flaky on this machine independent of my changes: on the old build it failed 3 of 5 runs alone, on the new build 3 of 8. The test "3D hero: hovering the brain... a click makes it fire" failed every time in an earlier run and passed in this one; I did not find out why. | `playwright.txt` (latest full run); `playwright-rerun.txt` is the earlier run |
| Content validation | passed (23 passages, 26 claims, 30 judged questions) | `validate.txt` |
| Contrast, text and focus pairs from the tokens (29 Oct, not re-run) | 38 pass | `contrast.txt` |
| Retrieval on 30 judged questions (27 answerable, 3 with no evidence; incl. typos and recruiter questions) | hit@1 0.96, hit@3 1.00, MRR 0.981, 3 of 3 no-evidence questions refused | `retrieval-eval.txt` |
| Production build | passed | `build.txt` |

`npm run e2e` could not start its web server on this Windows machine because `vite preview` listened only on IPv6 and the test waited on 127.0.0.1. I added `--host 127.0.0.1` to the `preview` script. The end-to-end build also ran out of memory until I raised Node's heap with `NODE_OPTIONS=--max-old-space-size=4096`.

## What failed

- "whois aziz" first found nothing. The question box now fixes everyday shorthand and tolerates small typos, and answers recruiter-style questions (who is he, internships, languages, where based) from profile passages. It still refuses judgements and money ("why should we hire you", salary).

- "whats aziz certifs" first answered "command not found". Plain questions now work, and a test checks that asking for an AWS credential I don't hold says so.
- My first question throttle ignored a question asked within 600 ms of page load. A browser test found it.
- Links like `/#projects` did nothing on load or refresh, because the page is rendered by script. Fixed and tested.
- The hero panel was taller than the screen. I shrank the headline, hid the intro paragraph while an answer is showing, and added a test that the panel fits at 1280x860, 1280x720, 390x844 and 320x640.
- I removed the page-wide pause button at my own request. That drops a WCAG 2.2.2 mechanism for motion longer than 5 seconds; reduced-motion visitors still get still frames, and the status text never depends on the animation.

- The 3D hero's problems were mostly mine, and the checks found them: ribbons that twisted into bow-ties (every strand looked dotted), a neighbour-count bug that made fibre paths jump across the brain, a loop that parked itself on its first frame, and a "highway" check I first wrote wrongly. Each is fixed and covered by a test or a check (`npm run check:fibers`, 14 criteria).
- The 3D brain starved the page. With software WebGL, the main thread was busy about 89% of the time in my test browser (profiler: about 1% was my JavaScript; the rest was native browser code while drawing), so a keypress waited 130 to 550 ms and the scroll flight to the nav felt like seconds. Reported on a real machine as a search box that did not respond and a slow flight. Fixes: the page now drops to the 2D hero at once when the browser reports a software renderer; the frame-rate check now ends a window after 2.5 s instead of waiting 120 + 90 frames (about 6 to 8 s to fall back on a 5 fps machine, instead of 20 to 40 s); the brain renders at 1.25 pixels per pixel at most (was 1.75); and it is not redrawn while it flies to the nav, since that move is only a CSS transform. Measured in the same test browser with the 3D forced on: main thread blocked 3332 ms over 8.2 s of scrolling before, 444 and 487 ms over 3.5 s after (a third run was 1470 ms over 7.2 s, a cold start). On this laptop's real GPU (Intel Iris Xe), in headless and in a visible Chromium window, the old and the new version both ran at about 60 fps with a typing round trip of 34 to 42 ms and nothing blocked, so I could not reproduce the slowness there and these changes made no measurable difference on that GPU. They help machines that draw WebGL on the CPU.

## What I learned

- My CV disagrees with the evidence this site uses. I built the site's answers from my repositories, not from the CV. The CV file is linked from Contact on the `redesign/on-main` branch; it is not on `main` yet. I compared the PDF with the site's passages on 6 Nov 2026 and found these differences:
  - TraffiX: the CV says I "led" the control subsystem in a 6-person team and labels the project "Live"; the site says I was in the Control pair with Fares Ben Kacem, roles rotate, and the project is a simulation, not a deployment. The CV calls 116.3 s versus 144.1 s the "peak" wait; the site says mean wait in the morning peak, and that no difference is significant with three seeds.
  - Administrative procedures assistant: the CV quotes only the development result (Hit@5 0.873 against 0.732 on 71 questions). On 20 held-out questions the hybrid scored 0.750, the same as dense search, and the team's report says part of the gain was overfitting.
  - Dates and names: the CV gives both the Sopra HR Software and the FlyRank internships as Jul–Sep 2026, while the site withholds the FlyRank dates; the CV says "Engineering Degree in Data Science", the site says Data Science Engineering; the CV's profile says "production" AI/ML experience, while the site says the HR system is a demo with in-memory jobs.
  - Figures that are not in this site's content and that I have not checked against the repositories: 32 features, 30K+ records, 286 chunks, 14 official sources, Mistral 7B.
- A relevant-looking link is not evidence. Each answer cites the passage's own source and anchor, and a build file is not a deployment.

## What remains unproven

- **The Amplify console record.** The address serves the site (checked 2026-11-06 with curl and in a real browser: HTTP 200, all sections rendered, no horizontal overflow at 1280 and 390 px, one question answered, CSP, HSTS and nosniff headers present), but I have no console build ID or AWS screenshots. Every outbound link and a private-window run of the full demo flow have NOT been checked against the final build.- **Frame rate and smoothness on real phones and laptops.** Everything about the 3D hero was verified in a browser with software WebGL. Bundle size (137 kB gzip for the 3D chunk) and transfer size (407 kB / 155 kB) are measured; frame timing on real GPUs is not.
- The retrieval score is optimistic: I wrote both the judged questions and the passage tags. Nobody else has tested it.
- Passage text and certification links were copied from my repositories and earlier portfolio on 28-29 Oct 2026 and have not been re-checked at the issuers since.
- The page-wide motion cannot be stopped by the visitor, and the manual keyboard and screen-reader audit from 28 Oct has not been repeated on the new hero.
- gitleaks was not run again (the tool is not installed in this session).
