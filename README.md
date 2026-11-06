# aws-superpower-portfolio

Aziz Messaoud's entry for the AWS Student Builder Challenge, "Build your tech superpower".

**I build practical AI systems**, and every project links to its repo, report or notebook, including what didn't work. The memorable part is **Ask Aziz** (the question box; it is evidence retrieval, not a language model): a question box in the first screen, with a neural "mind" beside it, for checking any claim against the evidence. The same engine also runs as a terminal further down. You ask about my projects or my AWS context; it answers only from verified portfolio and repository evidence, and shows **Answer, Evidence, Limitations**. When the evidence is missing it says *Not verified* instead of guessing, and when the evidence contradicts the question (for example "did TraffiX make ambulances faster?") it says so.

The mind animation shows interface state only: idle, listening, retrieving evidence, answering, uncertain, error. It does not show what a model "thinks" and it carries no confidence value. The same state is always written out as text.

## AWS status (read this before judging)

| Item | Status | Proof |
|---|---|---|
| Amplify Hosting build specification (`amplify.yml`: `npm ci` → `npm run build` → serve `dist/`) | **Prepared** | the file itself |
| Public site on AWS Amplify Hosting | **Live** at https://main.d3j3qw8xj45viu.amplifyapp.com/ (Region `eu-north-1`, as stated by Aziz). The address was checked on 2026-11-06: HTTP 200 and the page rendered in a real browser. | `endpointCheck` in `content/aws-status.yaml` |
| Amplify console build record (build ID and screenshot) | **Not captured yet** | `consoleRecord` is absent from `content/aws-status.yaml`; the site says so |
| Amazon Bedrock, AWS Lambda, Amazon API Gateway, S3 / Knowledge Bases | **Planned, not built** | none connected; the answer engine is a deterministic keyword retriever in the browser |

A build file is not a deployment and a plan is not a service. The site reads all of this from `content/aws-status.yaml` (the AWS section, the answer panel and the terminal), and `npm run build` fails if the file says `deployed: true` without a live URL and an endpoint check, if a console record has no build ID or no existing screenshot, or if a service is listed as both connected and planned. A reachable address and a console build record are separate evidence, so the site can say the first is verified and the second is still missing.

### Deploy with the console (no CLI, no access keys)

1. In AWS Billing → Budgets, create a small budget with an email alert (and a billing alarm) **first**.
2. AWS Amplify → Create new app → GitHub → authorise this repository only → branch `main`.
3. Check that Amplify shows the build settings from `amplify.yml` and `customHttp.yml`, then Save and deploy.
4. When the build succeeds, open the `*.amplifyapp.com` URL in a private window and run the demo flow below.
5. Then edit `content/aws-status.yaml`: set `deployed: true`, add `liveUrl` and an `endpointCheck` (date, method, result), and, once you have screenshotted the Amplify build page into `reports/screens/`, a `consoleRecord` (build ID, screenshot path, date). Run `npm run build`, push.

The steps above are how this site was deployed on 2026-10-31. The one open item is the console record: the `consoleRecord` block is waiting for a build ID and screenshot.

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

## The 3D hero (WebGL) and its fallback

The hero brain is a network of light drawn with WebGL on its own canvas, below the hero text. It is loaded lazily (a separate JS chunk, plus one geometry file chosen by device), and the page is complete without it. When anything is missing, the 2D hero is used instead.

| Flag | Effect |
|---|---|
| `?hero=canvas` | force the 2D hero (also what a device without WebGL2, with Save-Data, or without gzip streams gets) |
| `?tier=full` / `?tier=mobile` | force the geometry tier (otherwise chosen by window size, memory and cores, never by "touch device" alone) |
| `?gov=off` | turn off the frame-rate governor (used by tests, which render in software) |

Falls back to 2D when: no WebGL2, the asset fails to load, the GPU context is lost, or frames stay too slow after one quality step. Reduced motion draws a still, with no animation loop.

```
npm run bake:brain     # regenerate the two geometry files from the generator (deterministic, seed 7)
npm run check:fibers   # 14 structural criteria on the baked fibre networks
npm run check:budget   # fails if the 3D chunk exceeds 180 kB gzip, or the assets exceed their budgets
```

## Background video

One 5 s clip (supplied by Aziz, `reference/inputs/cosmos_123539191.mp4`) is the background of the **whole page**: in its original colours (no grade; the site's palette is sampled from it) and looped seamlessly by `scripts/make-page-video.sh` into `public/page-bg.mp4`, `.webm` and a poster. It is one fixed layer behind every section (`z-index: -1`), behind the 3D brain and the text. The sections' grounds are translucent navy, which is what lets it through (about 14%) and keeps text readable; cards stay solid. It plays only while the tab is visible, and is a still poster with reduced motion or Save-Data. Text keeps at least 4.5:1 contrast over it in every section and every frame (an e2e test measures all ten regions). Confirm you have the right to publish the clip before the judging window.

## Demo flow (run on the live URL)

1. Open the site in a private window; the hero loads.
2. About, Skills, Projects, AWS and Contact are in the navigation.
3. Ask `What did Aziz personally build in TraffiX?`: the status line shows *Retrieving evidence*, then an answer with the README link and the team-project limitation.
4. Ask `Did TraffiX make ambulances faster?`: the answer says the evidence disagrees (240.0 s against 213.2 s with actuated signals).
5. Ask `What is the AWS hosting status?`: it gives the live address, the endpoint check, says the console build record is not captured yet, and lists Amplify Hosting as the only connected service.
6. Ask `Does Aziz use Bedrock?`: *Not verified*, listed as planned only.
7. Ask something with no evidence (`What is your favourite colour?`): it refuses to guess.
8. Check desktop, a 390 px phone, keyboard focus, and reduced-motion mode.

## Where things are

- Content and evidence: `content/*.yaml` (claims, passages, sources, certifications, skills, AWS status). How to add to them: `docs/ADDING-CONTENT.md`. The working evidence register behind them is kept private.
- Answer engine (browser, no backend): `src/assistant/answer.ts`; mind state: `src/mind/state.ts`; scene: `src/scene/`.
- Write-up: `WRITEUP.md`. Rubric mapping: `docs/rubric-to-evidence.md`. Decisions: `docs/design-decisions.md`.
