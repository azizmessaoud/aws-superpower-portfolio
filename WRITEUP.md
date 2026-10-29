# Terminal Explorer: a portfolio that shows its work (draft for the Builder Center "Your project" entry)

> Status 29 Oct 2026: built and tested locally; code public on GitHub; **not deployed on AWS yet**. Every `TODO` must be replaced with what actually happened. Don't list an AWS service that wasn't used.

**Live site:** TODO (no Amplify deployment yet)
**GitHub:** https://github.com/azizmessaoud/aws-superpower-portfolio

## Problem

Portfolios often make big claims and leave the reader to trust them. An early prototype of this site did, and when I checked it against my repositories, several of its numbers and claims did not hold, so I dropped them. I wanted a portfolio where a reader can check every claim in a few seconds, including the parts that went badly.

## Idea

The **Terminal Explorer** is a question box in the first screen. You ask about my projects or my AWS context in your own words. It answers only from verified passages, and each answer has three parts: the answer, the evidence (the exact file and commit it came from), and the limitations. It keeps four outcomes apart:

- **Answer**: the evidence supports it.
- **The evidence disagrees**: the evidence says the opposite of the question's premise ("Did TraffiX make ambulances faster?" gets 240.0 s against 213.2 s with actuated signals).
- **Not verified**: nothing here proves it either way ("Does Aziz use Bedrock?").
- **Could not answer**: the question was empty or too long.

It retrieves; it does not write answers or judge anyone.

## Why the mind animation reflects the project

The point-cloud brain beside the question box is the interface's state, nothing else: idle, listening while you type, retrieving evidence, answering, uncertain (amber, calmer) or error. It never shows what a model "thinks" and it carries no confidence value. The same state is written as a line of text under the box, so it is readable without the animation and in reduced-motion mode. The brain is a picture of the honest part of the project: when the evidence is missing, it goes quiet instead of looking busy.

## Architecture

```
browser only (static site)
  content/*.yaml  --npm run build (validate, generate data)-->  src/generated/*.json
  question --> src/assistant/answer.ts (intent routing + BM25 retriever over 22 passages, with typo tolerance)
           --> Answer { outcome, answer, evidence[], limitations[] }
           --> hero panel and terminal (same engine), mind state --> Canvas scene

hosting (prepared, NOT deployed): GitHub --> AWS Amplify Hosting build (npm ci, npm run build) --> serve dist/
```

- No backend, no model, no network call while answering. `content/aws-status.yaml` is the one place AWS facts live; the build fails if it claims a deployment without a URL and a build record, or a service without evidence.
- **AWS services actually used: none yet.** Planned and not built: AWS Amplify Hosting (console deploy), Amazon API Gateway, AWS Lambda, Amazon Bedrock, S3 or Bedrock Knowledge Bases. If a backend is added later, the browser retriever stays as the fallback.

## What worked

- Treating content as data with a validator: it caught a mismatched source anchor and a withheld metric quoted in a comment on its first run, and it now also guards the AWS claims (checked by editing the files to break each rule, then restoring them).
- Separating "contradicted" from "not verified". My own test showed the difference matters: "Is TraffiX deployed in Tunis?" is a no (it is a simulation), "Does Aziz use Bedrock?" is "not verified".
- Local checks on 29 Oct 2026, with logs in `reports/logs/`:

| Check | Result | Log |
|---|---|---|
| Vitest (answer engine, typos and recruiter questions, mind state, retrieval, terminal) | 79 passed | `vitest.txt` |
| Playwright at 1280 and 390 px, incl. axe-core and the demo flow | 66 passed, 8 skipped by design | `playwright.txt` |
| Content validation | passed (22 passages, 25 claims, 26 judged questions) | `validate.txt` |
| Contrast, text and focus pairs from the tokens | 38 pass | `contrast.txt` |
| Retrieval on 26 judged questions (incl. typos and recruiter questions) | hit@1 0.96, hit@3 1.00, MRR 0.978, 3 of 3 no-evidence questions refused | `retrieval-eval.txt` |
| Production build | passed | `build.txt` |

## What failed

- "whois aziz" first found nothing. The question box now fixes everyday shorthand and tolerates small typos, and answers recruiter-style questions (who is he, internships, languages, where based) from profile passages. It still refuses judgements and money ("why should we hire you", salary).

- "whats aziz certifs" first answered "command not found". Plain questions now work, and a test checks that asking for an AWS credential I don't hold says so.
- My first question throttle ignored a question asked within 600 ms of page load. A browser test found it.
- Links like `/#projects` did nothing on load or refresh, because the page is rendered by script. Fixed and tested.
- The hero panel was taller than the screen. I shrank the headline, hid the intro paragraph while an answer is showing, and added a test that the panel fits at 1280x860, 1280x720, 390x844 and 320x640.
- I removed the page-wide pause button at my own request. That drops a WCAG 2.2.2 mechanism for motion longer than 5 seconds; reduced-motion visitors still get still frames, and the status text never depends on the animation.

## What I learned

- My CVs disagree with my repositories (degree name, city, internship dates, one FlyRank metric, how autonomous the HR pipeline is). I built the site from the repositories and kept the conflicts off the page until I settle them.
- A relevant-looking link is not evidence. Each answer cites the passage's own source and anchor, and a build file is not a deployment.
- TODO: my own words on what surprised me and what was hard in each project (not written yet).

## What remains unproven

- **The AWS deployment itself.** No live URL, no Amplify build record, no AWS screenshots yet. Live checks (headers, links, the demo flow in a private window) are NOT RUN until then.
- The retrieval score is optimistic: I wrote both the judged questions and the passage tags. Nobody else has tested it.
- Passage text and certification links were copied from my repositories and earlier portfolio on 28-29 Oct 2026 and have not been re-checked at the issuers since.
- The page-wide motion cannot be stopped by the visitor, and the manual keyboard and screen-reader audit from 28 Oct has not been repeated on the new hero.
- gitleaks was not run again (the tool is not installed in this session).
