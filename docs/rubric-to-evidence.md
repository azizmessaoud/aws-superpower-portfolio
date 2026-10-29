# Rubric-to-evidence matrix — AWS Student Builder Challenge

**Revision:** 3 — 28 October 2026, 23:00 (Africa/Lagos, UTC+1). Revision 2 text kept below each status change.
**Official source, re-opened this session:** the event page (rendered live 28 Oct 2026; 263 participants at fetch time), plus the Day 1 and Day 2 guides. Quotations below are copied from that render.
**Status words:** NOT STARTED · NOT RUN (artifact exists, check not run) · PASS · FAIL · BLOCKED. Built and tested locally on 28 Oct; nothing deployed. Statuses cite logs in `reports/logs/`.

## A. Official submission requirements

| ID | Official wording | Planned evidence | Verification | Status |
|---|---|---|---|---|
| R-00 | "Follow the step-by-step guides to build and deploy your portfolio website with **AWS Amplify Hosting**." | Amplify Hosting app connected to the GitHub repo; build record; notes on which guide steps were followed | Amplify console build history; screenshots; `WRITEUP.md` | **BLOCKED.** Day 3 (29 Oct) and Day 4 (30 Oct) not yet published; Day 2 conflicts with the no-AWS-CLI rule (D1); deploy not authorised. |
| R-01 | "A public portfolio website hosted on AWS that loads at a live URL and stays accessible through the judging window." | Live Amplify URL | Fresh-context Playwright smoke test; daily check 9–23 Nov | **BLOCKED** (no deploy) |
| R-02 | "Three core sections: About Me, Skills or Tech Superpowers, and Projects or Achievements (learning projects count)." | `#about`, `#skills`, `#projects` built from `content/` | Playwright presence and nav tests at 390 and 1280 px | **PASS (local)** — `#about`, `#skills`, `#projects` render; nav + mobile menu tested at 1280/390 (`reports/logs/playwright.txt`). Live: BLOCKED. |
| R-03 | "One creative feature that works without getting in the way of navigation." Plus, from About: "has to be interactive and it has to work, and visitors need a **visible hint** to find it." | "Ask my brain" with suggested questions as the hint; neural scene linked to verified passages | ≥ 12 judged questions + eval report; Playwright for hint, results, fallback, keyboard; nav still works | **PASS (local)** — 15 judged questions, hit@3 1.00, MRR 0.964; hero hint, results, no-result state, keyboard and suggestions tested. Embedding fallback NOT APPLICABLE (no embeddings). Live: BLOCKED. |
| R-04 | "A link to your GitHub repository." | Public `azizmessaoud/aws-superpower-portfolio`, linked in the footer | Open the link signed out | **PASS** — created and pushed on your request (28–29 Oct) |
| R-05 | A "your project" entry that "describes your creative feature, shows screenshots of your portfolio and AWS setup, documents the AWS services you used, and shares what you learned and the challenges you hit." | `WRITEUP.md`, kept current; genuine screenshots | Every statement cross-checked against this register, test output and the console | **IN PROGRESS** — `WRITEUP.md` draft; AWS parts TODO. |
| R-06 | "An original portfolio website that hasn't been published before." | New implementation and new copy from `content/`; `projectx0` untouched | Compare against the live site and the prototype | **IN PROGRESS** — new React code and new copy from `content/`; `projectx0` untouched. Note: the prototype exists as a **private** claude.ai artifact. Don't share its link, and don't ship it as the site. |
| R-07 | Eligibility: "verified students 18 or older with a Builder Center profile. See Rules for country and employee exclusions. Limit one entry per person." Individual challenge. | Your own confirmation | You read the Rules tab while signed in | **BLOCKED on you.** The Rules text did not render for me; your summary says Tunisia isn't excluded. |

## B. Judging rubric (official weights and wording)

| Criterion | Official explanation | Planned evidence | How verified | Status |
|---|---|---|---|---|
| Creativity and memorability — 30% | "how distinctive your creative feature is and how well it reflects you." | Retrieval over your real, verified work that shows *why* a passage matched and its limitations. It reflects the RAG and ranking work you actually do. The terminal is dropped: the official idea list already suggests "a command line visitors type into", and two visible competitors use one. | Judged-question eval; outside test with 3–5 people finding the feature unaided | **PARTIAL** — eval PASS (optimistic: same author for questions and tags); people test NOT RUN. |
| Working AWS implementation — 25% | "your AWS-hosted site loads during the judging periods, core links work, and your AWS usage is documented." | Amplify build record, live URL, link check, service list limited to what you used | Console screenshots; live Playwright; link checker | **BLOCKED** (Day 4 and deploy authorisation) |
| Communication quality — 25% | "how clearly your project, screenshots, and write-up explain your process and what you learned." | `WRITEUP.md`, design decisions, real failures and fixes, genuine screenshots | Each line matched to this register or to tool output | **IN PROGRESS** — `WRITEUP.md`, `docs/design-decisions.md` |
| Portfolio completeness and usability — 20% | "your website contains all three core sections, navigation works, and the content reads well on desktop and mobile." | Three sections; mobile menu; no overflow at 320/390/768/1280; focus rings; pause; reduced motion | Playwright, axe-core, contrast script | **PASS (local)** — 25 Playwright tests, axe 0 serious/critical, 38/38 contrast pairs; 320 and 768 px NOT RUN. Live: BLOCKED. |

Judging process (official): Gate 1 "AI and human scoring", top 50 advance; Gate 2 "a panel of AWS experts".

## C. Evidence and tests mapped to the rubric

| Evidence / test | Supports | Status (28 Oct, local) |
|---|---|---|
| Evidence register and source inventory (kept private, not in this repo) | Communication; truthful content | maintained; public mirror is `content/claims.yaml` + `content/sources.yaml` |
| `validate-content` | Communication; completeness | **PASS** — `reports/logs/validate.txt`; caught 2 real issues on first run |
| Vitest (tokenizer, BM25, retriever floor, scene geometry) | Creativity; working feature | **PASS** 28/28 (incl. terminal commands) — `reports/logs/vitest.txt` |
| Retrieval eval, 15 judged questions | Creativity | **PASS** hit@1 0.93, hit@3 1.00, MRR 0.964 — `reports/retrieval-keyword.json` |
| Playwright local (hero start/middle/end, brain docking into the nav, overflow, mobile menu, retrieval states, pause never self-resumes, idle/offscreen stop, reduced motion, keyboard focus, skip link, touch scroll, CLS, CSP) | Creativity; usability | **PASS** 45 passed, 3 skipped by design — `reports/logs/playwright.txt`, `reports/screens/` |
| WCAG 2.1 AA audit (`docs/accessibility-audit.md`) | Usability | **PASS (local)** — 9 issues found and fixed; real screen readers NOT RUN |
| axe-core | Usability | **PASS** 0 serious/critical (1280 and 390) |
| Contrast script | Usability | **PASS** 38/38 — `reports/logs/contrast.txt` |
| gitleaks + `.gitignore` | AWS implementation hygiene | **PASS** no leaks (dir scan); `.env*` and Amplify local config ignored (`git check-ignore`). Pre-commit hook and CI NOT SET UP |
| Labels never cross text (automated bounding-box test) | Usability | **NOT RUN** — checked by eye in screenshots only |
| Amplify build record + live URL | AWS implementation | **BLOCKED** (Day 4 guide; your authorisation) |
| Live Playwright + Lighthouse | AWS implementation; usability | **BLOCKED** |
| Genuine AWS console screenshots | Communication; AWS implementation | **BLOCKED** |

## D. Timeline

| Date (2026) | Event | Status |
|---|---|---|
| 27 Oct | Day 1 guide: account, Free Plan, project, AWS Budgets alert | Published; whether you have done it is unknown |
| 28 Oct | Day 2 guide: Agent Toolkit for AWS via `aws login` (AWS CLI) + AWS MCP Server | Published; conflicts with your rule → D1 |
| 29 Oct | Day 3: "Create your portfolio locally" | Not yet published |
| 30 Oct | Day 4: "Deploy globally" | Not yet published → Stage 6 BLOCKED |
| 6 Nov, 11:59 PM PST | Deadline (US daylight time ends 1 Nov, so PST = UTC−8) = **7 Nov, 08:59 in Tunisia (UTC+1)** | — |
| Weeks of 9 and 16 Nov | Gate 1, Gate 2; the site must stay live | — |
| Week of 23 Nov | Winners announced | — |

## E. AWS services — document only what is actually used

- Expected: **AWS Amplify Hosting** (console GitHub connection, `amplify.yml`, custom headers). **AWS Budgets** from Day 1, as supporting setup.
- Don't list CloudFront, Route 53, S3, Lambda, Bedrock or any other service unless the console shows it **and** `WRITEUP.md` says what you configured. If Amplify uses CloudFront internally, call it "managed by Amplify".
- Day 2's Agent Toolkit, AWS CLI and AWS MCP Server count as "used" only if you choose to follow Day 2 (D1).

## F. Submission checklist (performed by you, not the agent)

- [ ] Rules tab read while signed in; Tunisia and employee clauses confirmed
- [ ] Live Amplify URL loads in a private window; stays up 9–23 Nov
- [ ] About, Skills and Projects present; nav works on phone and desktop
- [ ] "Ask my brain" works; hint visible; nav unaffected
- [ ] Public GitHub repo linked
- [ ] Builder Center entry: feature, genuine site and AWS screenshots, actual services, lessons, challenges
- [ ] Original site; prototype link not shared
- [ ] Submitted before 7 Nov, 08:59 Tunisia time

## G. Changes in revision 3

- Local build and checks done; statuses updated with log paths. Deployment items unchanged (BLOCKED).

## H. Changes from revision 1

- Added R-00 (Amplify Hosting via the guides), the "visible hint" wording in R-03, and R-07 (eligibility).
- Day 1 and Day 2 are now inspected; Day 2 is flagged as conflicting with the no-AWS-CLI rule.
- The prototype is now found and audited; R-06 notes that it exists as a private claude.ai artifact.
- R-04 was re-checked: the repo is not public.
- Statuses reworded: nothing is "IN PROGRESS" except the three docs. The chat-only revision 2 marked Communication "IN PROGRESS", but nothing for it exists yet.
- Caching note for Stage 6, adopted from the other session's review: mark only Vite's hashed `/assets/*` as immutable; serve `/models/` under a versioned folder (`/models/all-MiniLM-L6-v2-<revision>/`).

> **Update 29 Oct 2026:** "Ask my brain" is now the Terminal Explorer (plain questions work, certifications included). The pause button was removed on request, so rows that mention it are out of date. Counts: Vitest 38, Playwright 52 passed / 4 skipped. Live checks and AWS rows are still BLOCKED until Amplify is deployed.
