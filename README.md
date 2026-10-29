# aws-superpower-portfolio

Aziz Messaoud's entry for the AWS Student Builder Challenge, "Build your tech superpower".

**I build practical AI systems**, and every project links to its repo, report or notebook, including what didn't work. The memorable part is the **Terminal Explorer**: a question box in the first screen, with a neural "mind" beside it, for checking any claim against the evidence. The same engine also runs as a terminal further down. You ask about my projects or my AWS context; it answers only from verified portfolio and repository evidence, and shows **Answer, Evidence, Limitations**. When the evidence is missing it says *Not verified* instead of guessing, and when the evidence contradicts the question (for example "did TraffiX make ambulances faster?") it says so.

The mind animation shows interface state only: idle, listening, retrieving evidence, answering, uncertain, error. It does not show what a model "thinks" and it carries no confidence value. The same state is always written out as text.

## AWS status (read this before judging)

| Item | Status | Proof |
|---|---|---|
| Amplify Hosting build specification (`amplify.yml`: `npm ci` → `npm run build` → serve `dist/`) | **Prepared** | the file itself |
| Site deployed on AWS Amplify | **Not deployed yet** (no live URL, no build record) | `content/aws-status.yaml` has `deployed: false` |
| Amazon Bedrock, AWS Lambda, Amazon API Gateway, S3 / Knowledge Bases | **Planned, not built** | none connected; the answer engine is a deterministic keyword retriever in the browser |

A build file is not a deployment and a plan is not a service. The site reads all of this from `content/aws-status.yaml` (the AWS section, the answer panel and the terminal), and `npm run build` fails if the file says `deployed: true` without a live URL and a build record, or if a service is listed as both connected and planned.

### Deploy with the console (no CLI, no access keys)

1. In AWS Billing → Budgets, create a small budget with an email alert (and a billing alarm) **first**.
2. AWS Amplify → Create new app → GitHub → authorise this repository only → branch `main`.
3. Check that Amplify shows the build settings from `amplify.yml` and `customHttp.yml`, then Save and deploy.
4. When the build succeeds, open the `*.amplifyapp.com` URL in a private window and run the demo flow below.
5. Only then edit `content/aws-status.yaml`: set `deployed: true`, add `liveUrl` and a `buildRecord` line (app name, build number, date), run `npm run build`, push. Keep screenshots of the Amplify build page in `reports/screens/`.

Adding Bedrock, Lambda or API Gateway later: build it, then add it to `connected` in `aws-status.yaml` with a link to the file or console record that proves it, and remove it from `planned`. Keep the browser retriever as the fallback.

### Cost and safety rules

Billing alarm and Budgets alert before anything that can charge; throttle requests at the API layer before a model is behind it; question length is already capped at 200 characters and one question per 600 ms in the browser; no AWS credentials in the frontend or the repository (IAM roles on the service side, never access keys); Bedrock token usage is not assumed to be free.

## Run it

```sh
npm ci
npm run dev            # local site
npm run build          # validate content → build data → type-check → build
npm test               # Vitest: answer engine, mind state, retrieval, terminal, geometry
npm run validate       # content rules (claims, sources, AWS status, deny-list)
npm run eval:retrieval # judged questions → reports/retrieval-keyword.json
npm run contrast       # WCAG pairs from src/styles/tokens.css
npx playwright test    # browser checks at 1280 and 390 px (needs `npm run build` first)
```

## Demo flow (run on the live URL once it exists)

1. Open the site in a private window; the hero loads.
2. About, Skills, Projects, AWS and Contact are in the navigation.
3. Ask `What did Aziz personally build in TraffiX?`: the status line shows *Retrieving evidence*, then an answer with the README link and the team-project limitation.
4. Ask `Did TraffiX make ambulances faster?`: the answer says the evidence disagrees (240.0 s against 213.2 s with actuated signals).
5. Ask `What is the AWS hosting status?`: it separates the prepared configuration from a verified deployment.
6. Ask `Does Aziz use Bedrock?`: *Not verified*, listed as planned only.
7. Ask something with no evidence (`What is your favourite colour?`): it refuses to guess.
8. Check desktop, a 390 px phone, keyboard focus, and reduced-motion mode.

## Where things are

- Content and evidence: `content/*.yaml` (claims, passages, sources, certifications, skills, AWS status). How to add to them: `docs/ADDING-CONTENT.md`. The working evidence register behind them is kept private.
- Answer engine (browser, no backend): `src/assistant/answer.ts`; mind state: `src/mind/state.ts`; scene: `src/scene/`.
- Write-up: `WRITEUP.md`. Rubric mapping: `docs/rubric-to-evidence.md`. Decisions: `docs/design-decisions.md`.
