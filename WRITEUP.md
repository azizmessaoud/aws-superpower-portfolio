# Ask my brain — write-up (draft for the Builder Center "Your project" entry)

> Status 29 Oct 2026 (updated): built and tested locally, code public on GitHub; **not deployed**. Every `TODO` must be replaced with what actually happened. Don't list an AWS service that wasn't used.

**Live site:** TODO (no Amplify deployment yet)
**GitHub:** https://github.com/azizmessaoud/aws-superpower-portfolio

## What it is

A portfolio whose creative feature is **Ask my brain**, a terminal you can type a plain question into ("whats aziz certifs", "are ambulances faster with TraffiX?"). It answers from verified passages, each with its limitations and a link to the exact file and commit it came from, and it lists my certifications with each issuer's own page. If nothing verified answers, or I hold no such credential (an AWS one, for example), it says so instead of guessing. It retrieves evidence; it doesn't write answers or judge anyone.

Each project also ends with the same four-part label: where the data came from, how it was judged, where it fails, and who reviews the output. The terminal prints the same label with `label <project>`.

The hero carries the same idea visually: a point-cloud brain inside a sphere of my skills (from my existing portfolio). On open the camera pulls back from the brain; scrolling while the hero is pinned dollies back into it.

**Visible hint:** the headline is "Ask my brain what I've built", the main button goes to the terminal, and a "Try: Are ambulances faster with TraffiX?" button under the buttons runs that question.

## How it works

- Content lives as data: `content/sources.yaml`, `claims.yaml`, `passages.yaml` (16 passages), `judged.yaml` (15 questions).
- `scripts/validate-content.ts` fails the build if a passage publishes an unresolved or prohibited claim, a caveated claim has no limitation, or any source file contains a deny-listed phrase (invented metrics, deployment claims before deployment).
- Retrieval is my own BM25 with field weights, a light English/French stemmer and a small synonym list, running entirely in the browser.
- Static React + TypeScript + Vite site; no backend, no forms that send data.

## Results I measured (local, 28 Oct 2026)

| Check | Result | Evidence |
|---|---|---|
| Retrieval, 15 judged questions | hit@1 0.93 · hit@3 1.00 · MRR 0.964 · 1/1 out-of-scope question correctly refused | `reports/retrieval-keyword.json` |
| Unit tests (Vitest) | 38 passed (29 Oct, after the terminal and certification changes) | `reports/logs/vitest.txt` |
| Browser tests (Playwright, 1280 and 390 px) | 52 passed, 4 skipped by design (29 Oct) | `reports/logs/playwright.txt` |
| Accessibility audit (WCAG 2.1 AA) | 9 issues found, 9 fixed on 28 Oct, before the pause button and the separate Ask section were removed; not re-audited by hand since | `docs/accessibility-audit.md` |
| axe-core | 0 serious or critical violations (desktop and mobile), part of the 29 Oct Playwright run | `reports/logs/playwright.txt` |
| Contrast (38 text and focus pairs) | all pass (29 Oct) | `reports/logs/contrast.txt` |
| gitleaks | no leaks found on 28 Oct; NOT RUN since (tool not installed in this session) | `reports/logs/gitleaks-dir.txt` |

Caveat: I wrote both the judged questions and the passage tags, so the retrieval score is optimistic. TODO: add questions written by someone who hasn't seen the tags.

## AWS services used

- TODO **AWS Amplify Hosting** — only once the repo is connected in the console and a build succeeds. `amplify.yml` and `customHttp.yml` are prepared.
- TODO AWS Budgets alert, only if set up during the Day 1 guide.

## Screenshots

- Portfolio (local build): `reports/screens/` — hero start, middle, end at 1280 and 390 px; Ask my brain results; mobile menu; reduced motion. TODO retake on the live URL.
- TODO AWS: Amplify app overview, successful build log, domain/URL page.

## What I learned / challenges (true so far)

- My own CVs disagree with my repositories (degree name, city, internship dates, one FlyRank metric, and how autonomous the HR pipeline is). I built the site from the repositories and kept the conflicts off the page until I resolve them.
- A validator caught my own mistakes on its first run: a passage with a mismatched source anchor, and a withheld metric quoted in a code comment.
- The first browser review found the hero headline hidden for 1.5 s by an intro timer, and brain dots drawn behind the pause button. Both are fixed and now have tests.
- A strict Content-Security-Policy would have blocked an inline boot script; I moved it to a same-origin file instead of weakening the policy, and test the page under that exact policy.
- My first "whole page" idea, a floating brain button in the corner, covered text on phones. Docking the brain into the navigation instead fixed it and made the feature's hint visible on every screen.
- The accessibility audit caught things automated tools don't: a toggle announcing two states, a duplicate link, and focus not landing in the search box after a keyboard jump.
- I brought back the terminal from my first prototype because it was eye-catching, but wired it to the same verified passages instead of scripted answers, and fixed its keyboard trap (it used to swallow the Tab key).
- Visitors don't type commands. My own test, "whats aziz certifs", answered "command not found", so the terminal now treats a sentence as a question, and a test checks that it refuses to claim a credential I don't hold.
- I removed the page-wide pause button at my own request. That drops a WCAG 2.2.2 mechanism for motion longer than 5 s; reduced-motion users still get still frames.
- TODO: my own words on what surprised me and what was hard in each project (not written yet).
- TODO: deployment lessons (Amplify build, headers, live checks).
