# aws-superpower-portfolio

Aziz Messaoud's entry for the AWS Student Builder Challenge. A portfolio whose creative feature, **Ask my brain**, finds verified passages about my projects and shows the evidence behind each one.

```sh
npm ci
npm run dev            # local site
npm run build          # validate content → build corpus → type-check → build
npm test               # Vitest: tokenizer, BM25, retrieval floor, scene geometry
npm run eval:retrieval # judged questions → reports/retrieval-keyword.json
npm run contrast       # WCAG pairs from src/styles/tokens.css
npx playwright test    # browser checks at 1280 and 390 px (needs `npm run build` first)
```

- Content and evidence: `content/*.yaml`, mirrored by `docs/evidence-register.md`.
- Hosting: `amplify.yml` and `customHttp.yml` are prepared for AWS Amplify Hosting; not deployed yet.
- Write-up: `WRITEUP.md`. Rubric mapping: `docs/rubric-to-evidence.md`.
