# Claude Code prompt — `aws-superpower-portfolio` system design and build

> Paste everything below the line into Claude Code, started inside an empty folder named `aws-superpower-portfolio`. Attach or copy in: `docs/source-inventory.md` (revision 2), the two draft docs `docs/evidence-register.md` and `docs/rubric-to-evidence.md` (revision 1), and the prototype `AIEngineerOS·AzizMessaoud.html`.

---

You are helping me, Aziz Messaoud, build my entry for the **AWS Student Builder Challenge: Build Your Tech Superpower** (deadline **6 Nov 2026, 11:59 PM PST**). I'm a 5th-year Data Science Engineering student at ESPRIT, Tunisia. I'm learning: explain each important decision and its trade-off as you go, briefly and in plain English.

Work in stages. **Stop at every gate marked ⛔ and wait for my written approval.** Don't start application code until I approve Stage 1.

## 0. Non-negotiable rules

1. Don't edit `projectx0` or its `gh-pages` branch.
2. Don't use IAM access keys. Don't commit secrets. The site needs no secrets at all.
3. Don't use the AWS CLI unless I approve it in Decision D1.
4. Don't create a GitHub repo, push, deploy, publish or submit unless I explicitly ask in that turn.
5. Don't claim a test passed unless you ran it and show the output. Don't claim deployment without a real Amplify build record and a working public URL.
6. Don't invent facts, metrics, contributions, tools or limitations. Every project claim on the site must trace to a record in `content/` that links to primary evidence.
7. **The prototype is a design input only.** Claude generated it, and its project content is false. Never copy its copy, metrics, stacks or links (see §3.4).
8. If a source conflicts with another, record the conflict and ask. Don't pick the more impressive version.
9. **Precedence:** my messages → this prompt → `docs/` (revision 2) → everything else. `aws_student_builder_challenge_claude_brief (1).md` and the prototype were written by Claude earlier and are **superseded**. They are not specs and not evidence. Don't reuse the brief's text in the Builder Center write-up.

## 1. Requirements

### 1.1 Functional (from the official event page, re-checked 28 Oct 2026)

| ID | Requirement | Where it's met |
|---|---|---|
| F1 | Public site hosted on AWS at a live URL, accessible through judging (Gate 1 week of 9 Nov, Gate 2 week of 16 Nov, winners week of 23 Nov) | AWS Amplify Hosting (§4.6) |
| F2 | Three core sections: About Me, Skills, Projects | `sections/` |
| F3 | One **interactive**, **working** creative feature with a **visible hint**, which doesn't get in the way of navigation | "Ask my brain" (§4.3) plus the neural scene (§4.4). **The terminal explorer is dropped.** The official idea list already suggests "a command line visitors type into", two visible competitors use one, and my task prompt rejects a terminal added only to look technical. |
| F4 | Link to the public GitHub repo | Footer and About |
| F5 | Builder Center write-up: feature, genuine screenshots of site and AWS setup, AWS services actually used, lessons, challenges | `WRITEUP.md`, kept current from day one |
| F6 | Original site not published before | New implementation; new copy written from `content/` |
| F7 | Built and deployed "with AWS Amplify Hosting" by following the official guides | Stage 6. Re-read Day 3 (29 Oct) and Day 4 (30 Oct) before deciding the deploy path. |

Rubric: creativity and memorability 30% · working AWS implementation 25% · communication 25% · completeness and usability 20%.

### 1.2 Non-functional targets (targets, not results)

| Area | Target |
|---|---|
| Performance | Lighthouse ≥ 90 mobile. Initial JS ≤ 120 kB gzip. LCP ≤ 2.5 s on simulated 4G. CLS ≤ 0.05. The embedding model never loads before the visitor uses the feature. |
| Accessibility | Lighthouse ≥ 95; axe-core 0 serious/critical; normal text ≥ 4.5:1; visible focus ring on every interactive element; full keyboard use; `prefers-reduced-motion` honoured; pause control for all animation; state never shown by colour or motion alone. |
| Layout | No horizontal overflow at 320, 390, 768, 1280 px. Canvas labels never cross text. |
| Resilience | The site works with JS-loaded fonts blocked, with the model download failing, and with animation paused. Retrieval falls back to keyword search. |
| Energy | The animation loop stops when the tab is hidden, when the hero is off-screen, or when paused. The frame budget is capped at 30 fps on low-power devices. |
| Determinism | Seeded RNG for the scene; fixed corpus; fixed judged questions, so tests are stable. |
| Security | Static only: no backend, no forms that send data. CSP and security headers through Amplify custom headers. gitleaks in pre-commit and CI. |
| Cost | Fits in the AWS Free Plan described in the Day 1 guide. AWS Budgets alert set (Day 1). |

### 1.3 Constraints

Solo builder · 9 days from 28 Oct · React + TypeScript + Vite (challenge this only with a strong reason, stated before you scaffold) · my desktop runs Windows (checked from the Claude desktop link; ask me if you run somewhere else) · Amplify Hosting through the console's GitHub connection · no server. **Stage 6 is BLOCKED until the Day 4 guide is published (30 Oct).** F7 is BLOCKED until Day 3 and Day 4 are both read.

## 2. Decisions I must make (ask me; don't assume)

| ID | Question | Context |
|---|---|---|
| D1 | The official Day 2 guide connects the agent through the **AWS CLI** (`aws login`, temporary credentials, no access keys) plus the AWS MCP Server. My rule says no AWS CLI. Follow Day 2, or skip it and deploy through the Amplify console only? | Hosting does not require Day 2. Ask before any AWS action. |
| D2 | Which CV is current? The live-site CV (Google Drive `aziz_messaoud.pdf`) says "Bachelor of Computer Engineering", FlyRank Jul–Sep 2026, Nabeul. The live site says Data Science Engineering, FlyRank Jul–Aug 2026, Ariana. | Until answered, use the live-site wording and mark conflicts. |
| D3 | FlyRank authorship: the repo is FlyRank's **starter repo**. Which parts did I write? | Decides whether 0.24→0.74 can appear at all. |
| D4 | TN Procedures Assistant: is there a repo or demo, and which stack is real? | Three conflicting descriptions exist (§3.3). Default: exclude. |
| D5 | HR repo and Sopra HR: may the public repo and case study be shown as internship work, with no confidential material? | Default: describe it as a prototype on synthetic data; name Sopra only as I do on the live site. |
| D6 | Embedding threshold: how much better must embeddings score than keyword search to be worth about 23 MB? | Proposed: MRR +0.10 on the judged set with no question dropping out of the top 3. |
| D7 | PySpark appears in none of my verified sources. Keep it off Skills unless I give evidence? | Default: off. |

## 3. Evidence already verified (28 Oct 2026) — re-open the files and confirm before you rely on them

### 3.1 Primary sources

- TraffiX `github.com/azizmessaoud/traffix` @ `d54b071`: README (simulation only; SUMO through TraCI; six-person team; I'm in the Control pair with Fares Ben Kacem: SUMO, observations, A1, safety, controllers; roles rotate). Validation report `docs/presentation/prototype-validation.md` §5.1–5.6.
- FlyRank `github.com/azizmessaoud/flyrank` @ `a220b9e`: `README.md` (Starter Repo), `GUIDE.md`, `outputs/model_report.md`, `work/capstone_report.md`, `work/notebooks/w05_model.ipynb` (cell output).
- HR `github.com/azizmessaoud/hr-anomaly-detection` @ `437a514`. The old URL `hr-anomaly-scaffold` clones to the same commit. README, `docs/system-record.md`.
- Live portfolio `azizmessaoud.github.io/projectx0` (JS-rendered; use a real browser). It is the copy and voice baseline.
- Official event page and the Day 1 and Day 2 guides on builder.aws.com.

### 3.2 Claims cleared for use, with mandatory context

| Claim | Evidence | Must travel with it |
|---|---|---|
| TraffiX is a multi-agent traffic-control **simulation** on six Tunis junctions | README; validation report | Synthetic demand; 18 of 21 junction roads have unverified lane counts; course project until Dec 2026; team of 6 |
| ≈18 car greens started during pedestrian crossings per run vs 331–405 with actuated control (−95%) | Report §5.3 | 3 scenarios × 3 seeds; not significant at p < 0.05; not zero; simulated |
| Morning-peak pedestrian wait 116.3 s vs 144.1 s actuated (−19%) | Report §5.3 | 3 seeds; not significant; one scenario |
| Ambulance trips **slower**: 240.0 s vs 213.2 s actuated (197.0 s fixed-time) | Report §5.3–5.5 | Show wherever emergency handling is mentioned |
| 115 automated tests pass; 7 of 11 models beat their rule | Report §5.1, §5.4 | As reported on 20 Oct 2026; not re-run by us |
| FlyRank capstone: Precision@50 **0.94** (Random Forest) vs **0.76** (fixed baseline) | `w05_model.ipynb` output; `capstone_report.md` | Top 50 of 1,583 held-out pages, 8 unseen clients; hit = ≥ 8 next-week clicks (training 75th percentile); features 31 Mar 2026 → clicks 1–7 Apr 2026; observational, not causal; one date and one week; June validation pending; warehouse is gated. R² 0.50 vs 0.2621. |
| HR pipeline: pre-flight checks → Docling → RapidOCR fallback → schema and business validation → cohort anomaly detection → explained, masked flags → human review; never writes to an HRIS | HR README | Synchronous FastAPI demo, in-memory jobs, synthetic samples only; CSV/Excel out of scope; no real-document accuracy has been measured |

### 3.3 Unresolved: omit unless I resolve it

- FlyRank 0.24→0.74: the **starter pipeline's** reference result on its bundled 30,000-row sample (classification target `is_declining_label`, client holdout; RF varies 0.68–0.74 by library version). Never merge it with 0.76→0.94. Blocked on D3.
- HR "92.3% accuracy" and "26 fields in four sections": no evaluation artifact found.
- TraffiX "owned the agentic architecture": the live site says it; the README splits work by pair and says roles rotate. Ask me.
- TN assistant: (a) my notes: Telegram bot `@Tnadmin12bot`, n8n, Gemini, `gemini-embedding-001`, Qdrant, role Corpus & RAG, course project; (b) another CV: BM25 + dense + RRF + Groq; (c) prototype: invented. Blocked on D4.
- ALIA: NDA; not tested with real trainers. Exclude from featured work.

### 3.4 Prohibited: invented by the prototype or contradicted by sources

Never publish these. Add them to the content lint (§4.2): "87% answer accuracy", "+34% nDCG", "34%", "mAP", "24 fps", "4.3/5", "2,400 bilingual", "3+ years", "4 production", "production-grade", "AI systems I've shipped", "systems that actually ship", YOLOv8/DeepSORT/Gradio for TraffiX, "agentic RAG" for HR, "Search Ranking Engine", AraBART/ChromaDB/Streamlit for TN, generic `huggingface.co/spaces` demo links, "deployed on AWS Amplify" (until true), "responds within 24 hours", the earlier TraffiX one-seed figures (−41%, 487 → 241 s), and any claim that TraffiX controls real traffic or that FlyRank causes traffic gains.

## 4. System design

### 4.1 Architecture

```
            BUILD TIME (local + Amplify build)                       RUNTIME (visitor's browser)
┌───────────────────────────────────────────────┐          ┌──────────────────────────────────────────┐
│ content/*.yaml  (sources, claims, passages,   │          │  index.html + app shell (React)           │
│                  projects, judged questions)  │          │   ├─ sections: Hero, About, Skills,       │
│        │                                      │          │   │  Projects (per-project layouts),      │
│        ▼                                      │          │   │  Ask, Contact, Footer                 │
│ scripts/validate-content.ts  ── fails build ─▶│ errors   │   ├─ NeuralScene (canvas, lazy, paused    │
│   (schema, links, status, lint, limitations)  │          │   │   when hidden / reduced motion)       │
│        │                                      │          │   └─ AskMyBrain                           │
│        ▼                                      │          │        ├─ KeywordRetriever (BM25, sync)   │
│ scripts/build-corpus.ts ─▶ src/generated/     │  bundle  │        └─ EmbeddingRetriever (optional,   │
│                corpus.json + bm25-index.json ─┼────────▶ │             Web Worker, loads on first    │
│                                               │          │             query, falls back to BM25)    │
│ tools/embed/ (Python, OFFLINE, run by hand)   │          │                                           │
│   sentence-transformers all-MiniLM-L6-v2      │          │  Model files: self-hosted under           │
│   ─▶ src/generated/vectors.json + manifest    │──commit─▶│  /models/ (no third-party fetch)          │
│                                               │          └──────────────────────────────────────────┘
│ vite build ─▶ dist/ ─▶ Amplify Hosting (CDN)  │
│   amplify.yml · custom headers (CSP, cache)   │
└───────────────────────────────────────────────┘
```

Why this shape: the site is static, so the only things that can break are content truth, the browser feature and the deploy. Evidence lives as data with a validator in front of the build, so a false claim fails the build instead of reaching a judge. Retrieval runs entirely in the browser, with no server, keys or cost.

### 4.2 Data model (`src/content/schema.ts`; YAML validated with zod)

```ts
type Status = 'supported' | 'caveated' | 'unresolved' | 'prohibited';

interface Source   { id: string; kind: 'repo'|'report'|'notebook'|'site'|'cv'|'official';
                     url: string; ref?: string /* commit or section */; checkedOn: string; }
interface Claim    { id: string; projectId: string; text: string; status: Status;
                     sources: string[]; metric?: { name: string; value: string; definition: string;
                     conditions: string; baseline?: string }; limitations: string[]; contribution?: 'mine'|'team'|'shared'; }
interface Passage  { id: string; projectId: string; claimIds: string[]; text: string;
                     context: string; limitations: string[]; evidenceUrls: string[]; tags: string[]; }
interface Project  { id: 'traffix'|'flyrank'|'hr-docs'|string; title: string; framing: string;
                     layout: 'control-hierarchy'|'ranking-queue'|'pipeline'; claimIds: string[];
                     nodeIds: string[]; repoUrl?: string; }
interface JudgedQ  { id: string; question: string; relevantPassageIds: string[]; note?: string; }
```

`validate-content` fails the build when:

- a published claim is `unresolved` or `prohibited`;
- a claim has no source, or a `caveated` claim has no limitation;
- a metric lacks a definition or conditions;
- an evidence URL is not `https://github.com/azizmessaoud/...`, the live site, or an official page;
- any rendered string matches the §3.4 deny-list.

Keep `docs/evidence-register.md` and `content/claims.yaml` in sync: the register is the human view, the YAML is the machine one.

### 4.3 "Ask my brain" — the retrieval module

**Interface (one deep module):**
```ts
createRetriever(corpus, opts?) => {
  search(query: string, k?: number): Promise<Result[]>,
  mode: 'keyword' | 'semantic',
  status: 'ready'|'loading-model'|'fallback'
}
interface Result { passage: Passage; score: number; why: { matchedTerms: string[]; field: string; mode: string };
                   limitations: string[]; evidenceUrls: string[]; }
```
- **Keyword first:** your own small BM25 (k1 = 1.2, b = 0.75), lowercased, with accents folded, English stopwords removed, a light stemmer, and a hand-written synonym map stored in content (e.g. "pedestrian ↔ crossing", "ranking ↔ prioritise", "OCR ↔ scanned"). Field boosts: tags ×2, text ×1, context ×0.5. Explain trade-off: writing 80 lines of BM25 instead of using MiniSearch gives full control over the "why it matched" explanation, at the cost of a little extra code to test.
- **Judged set:** ≥ 12 questions in `content/judged.yaml`, written by me and you together, each with expected passage IDs. Include paraphrases, a French question, an out-of-scope question (expected: an honest "no verified passage" state) and a trap question (e.g. "Is TraffiX deployed in Tunis?" → the simulation-limitation passage).
- **Evaluation script** `npm run eval:retrieval`: prints hit@1, hit@3, MRR and a per-question table, and writes `reports/retrieval-<mode>.json`. A Vitest test asserts the keyword baseline's agreed floor.
- ⛔ **Embedding gate:** only after I approve the baseline and the question set. Add embeddings only if the measured gain meets D6.
- **If embeddings are justified:**
  - `tools/embed/embed.py` pins `sentence-transformers` and the exact model revision hash. It uses mean pooling and L2 normalisation and writes `vectors.json` plus `manifest.json` (model ID, revision, library versions, pooling, normalisation, corpus SHA-256, date). Run it by hand, never in the Amplify build.
  - In the browser, `@huggingface/transformers` (Transformers.js) loads the matching quantized `all-MiniLM-L6-v2` **from `/models/` on the same origin**. Loading happens inside a Web Worker, only after the first submitted query, with a visible "loading model (≈23 MB)" state, a timeout and an abort.
  - A parity test embeds 5 passages in both Python and JS and asserts cosine ≥ 0.99.
  - Combine scores as `0.5·bm25_norm + 0.5·cosine` only if eval shows it beats either alone.
  - Any failure keeps keyword mode and says so on screen.
- **UI states:** idle (with suggested questions as the visible hint), typing, searching, results, no verified passage, model loading, fallback, error. Each result shows the project, the passage, why it matched, its limitations, and direct evidence links. It never claims to measure my skill.
- **Neural link:** ⛔ connect results to node highlighting only after retrieval points to verified passages. Then `scene.select(result.passage.projectId nodes)`, announced through an `aria-live` region.

### 4.4 Neural scene — the animation module

**Interface:**
```ts
createScene(canvas, { seed, nodes, edges, reducedMotion }) => {
  pause(), resume(), select(nodeIds: string[]), focusNode(id), destroy(),
  onSelect(cb: (nodeId) => void)
}
```
- The simulation (`scene/sim.ts`) is pure: `step(state, dt, pointer) → state`, with a seeded RNG, and is unit-tested. The renderer (`scene/render.ts`) is Canvas 2D: draw only, with no logic.
- Nodes map to real evidence (projects, methods, verified tools), not decorative buzzwords. Labels render only in an **exclusion-free zone**. The headline and lead block's bounding box is passed in, and nodes are repelled from it, so text is never crossed.
- Pointer influence is subtle and clamped, and the scene eases back when the pointer leaves. No `preventDefault` on touch: page scroll must always work.
- Keyboard: a visually hidden but focusable list of nodes mirrors the canvas. Arrow keys move focus; Enter selects. Selection shows a ring plus a text label, not colour alone.
- Power: `IntersectionObserver` stops the loop off-screen, and `visibilitychange` stops it when the tab is hidden. A visible **Pause/Play** button. Reduced motion means a static, fully drawn frame with no loop. `devicePixelRatio` is capped at 2.
- Lazy: the scene code loads after first paint, so the hero text is server-rendered HTML and never waits for the canvas.

### 4.5 Front-end structure

```
src/
  styles/tokens.css       # extracted from the prototype + new spacing/radius/type/motion/easing tokens
  styles/base.css
  content/ (schema.ts, load.ts)       generated/ (corpus.json, bm25-index.json, vectors.json?)
  retrieval/ (bm25.ts, tokenize.ts, synonyms.ts, retriever.ts, embed.worker.ts)
  scene/ (sim.ts, render.ts, scene.ts, NeuralScene.tsx)
  sections/ (Hero, About, Skills, Projects/{TraffixCase, FlyrankCase, HrCase}, AskMyBrain, Contact, Footer)
  ui/ (Button, Nav + MobileMenu, FocusRing, LiveRegion)
content/ (sources.yaml, claims.yaml, passages.yaml, projects.yaml, judged.yaml)
scripts/ (validate-content.ts, build-corpus.ts, eval-retrieval.ts, contrast-check.ts)
tools/embed/ (embed.py, requirements.txt, README.md)
tests/ unit/  e2e/  a11y/
docs/ (source-inventory.md, evidence-register.md, rubric-to-evidence.md, design-decisions.md)
WRITEUP.md   amplify.yml   .gitleaks.toml   .gitignore
```
- **Tokens:** extract the real values from the prototype (inventory in `docs/source-inventory.md` Appendix A), then fix the measured failures: violet text 3.93–4.19:1 on navy (use `#a78bfa` for text); white on the `#3b82f6` button end 3.68:1; no focus styles; no mobile menu below 640 px; labels over the headline; emoji icons. Add fallback font stacks. Components may only use tokens; `scripts/contrast-check.ts` and a stylelint rule enforce it.
- **Motion:** compare CSS transitions with Motion for React in Stage 2. Default: CSS transitions with shared `--dur-*` / `--ease-*` tokens; Motion only where layout animation earns its ~30 kB.
- **Projects:** three different layouts driven by real content. TraffiX gets the control-hierarchy diagram with mixed results; FlyRank gets the ranking queue with baseline vs model; HR gets the pipeline with status outcomes. No identical cards.
- **Routing:** a single page with `#about`, `#skills`, `#projects`, `#ask` anchors, so no SPA rewrite rules are needed.

### 4.6 Hosting on AWS (Stage 6, only when I ask)

- Amplify Hosting console → create an app from the GitHub repo, `main` branch, following the Day 4 guide's exact steps (published 30 Oct; read it first). Builds run in Amplify; the browser-based console flow needs no keys.
- `amplify.yml`: `npm ci` → `npm run validate` → `npm run build`; `baseDirectory: dist`. Do not run `tools/embed` in the build.
- Custom headers: CSP `default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Add `'wasm-unsafe-eval'` to `script-src` only if Transformers.js needs it, and say why. Also `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Immutable caching only for Vite's hashed `/assets/*`. Serve model files from a versioned folder (`/models/all-MiniLM-L6-v2-<revision>/`), so a re-run of `embed.py` never serves stale files. `no-cache` for `index.html`.
- Document only services actually used (probably just **AWS Amplify Hosting**, plus AWS Budgets from Day 1). Mention CloudFront only if Amplify's docs and my console show it, and describe it as managed by Amplify, not configured by me.
- Reliability during judging: a static CDN needs no scaling work. Freeze `main` after submission; any fix goes through a branch preview first. Before judging, run a Playwright smoke test against the live URL each day of 9–23 Nov; I run it, you write it.

### 4.7 Testing and evidence

| Check | Tool | When |
|---|---|---|
| Pure modules (BM25, tokenizer, sim step, content validator) | Vitest | every change |
| Retrieval quality | `eval:retrieval` + Vitest floor | Stage 4 |
| Navigation, retrieval states, fallback (block `/models/`), pause, reduced motion, hidden tab, keyboard, focus rings, mobile menu, no overflow at 390 px, labels never intersect text (bounding-box assertion) | Playwright | Stages 3–5 |
| Accessibility | `@axe-core/playwright` | Stage 5 |
| Contrast | `scripts/contrast-check.ts` over token pairs | Stage 3 |
| Secrets | gitleaks (pre-commit + CI) | from first commit |
| Live | Playwright in a fresh context + Lighthouse on the Amplify URL | Stage 6, after I authorise deploy |

Report each acceptance criterion as **PASS / FAIL / BLOCKED / NOT RUN**, with pasted output.

### 4.8 Trade-offs to explain to me before committing

React + Vite vs Astro (Astro ships less JS, but React fits the interactive feature and I know it) · Canvas 2D vs WebGL (2D is enough for about 60 nodes and is simpler to test) · your own BM25 vs MiniSearch · self-hosted model vs Hugging Face CDN (same-origin keeps the CSP tight and avoids third-party failure; costs about 23 MB of hosted files) · CSS transitions vs Motion · one page vs routes.

### 4.9 What to revisit later

A larger corpus or more projects → a hybrid index built at build time; a visitor-question log → only with consent and a backend, so not now; more languages → French and Arabic tokenisation.

## 5. Stages and gates

1. **Stage 1 — evidence.** `docs/source-inventory.md` revision 2 is done. Update `docs/evidence-register.md` and `docs/rubric-to-evidence.md` to revision 2 using §3. Re-open each source you can reach. Rows for sources you can't reach (S-10, S-17, S-19) stay **not re-verified**; don't block on them. Add the prototype claims as prohibited. Mark the prototype as available. List open questions D1–D7. ⛔
2. **Stage 2 — design critique.** Use the frontend-design plugin. If it isn't installed, look for it with `/plugin`. If you still can't find it, do the critique by hand and say so. Screenshot the prototype at 1280 and 390. Keep ≥ 3 things and change ≥ 3, with reasons. Propose one direction grounded in my real work. Cover type, colour, layout, motion and accessibility trade-offs, and CSS vs Motion. Write `docs/design-decisions.md`. ⛔
3. **Stage 3 — scaffold, content pipeline, sections, tokens and ambient scene,** built together with motion. Verify with Vitest + Playwright + contrast. Update `WRITEUP.md`. ⛔
4. **Stage 4 — keyword retrieval + judged set + eval.** ⛔ Embedding decision (D6). ⛔ Node highlighting only after verified results.
5. **Stage 5 — review loop:** screenshots at 1280/390 → list problems → fix the top ones → repeat. Ask: could this belong to any AI engineer? Does every effect serve content, navigation, interaction or evidence? Does it still look strong when paused? Run axe, contrast and gitleaks. ⛔
6. **Stage 6 — prepare `amplify.yml` and headers.** Deploy, live tests and Lighthouse **only when I ask.** Then `WRITEUP.md` gets real screenshots and real lessons; anything unverified stays a TODO.

Begin with Stage 1 only. First tell me in 3–5 lines what you understood and anything in this prompt you think is wrong.
