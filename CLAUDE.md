# aws-superpower-portfolio — instructions for Claude Code

Aziz Messaoud's entry for the AWS Student Builder Challenge (deadline 6 Nov 2026, 11:59 PM PST = 7 Nov, 08:59 Tunisia). Aziz is learning: explain important decisions and trade-offs briefly, in plain English. Answer in English.

## Read first, in this order

1. `CLAUDE_CODE_PROMPT.md` — the full spec: requirements, system design, stages, gates, decisions D1–D7.
2. `docs/evidence-register.md` — which claims may appear on the site (revision 2, checked against sources on 28 Oct 2026).
3. `docs/rubric-to-evidence.md` and `docs/source-inventory.md`, including Appendix A (prototype tokens and measured defects).

Precedence: Aziz's messages → `CLAUDE_CODE_PROMPT.md` → `docs/` → everything else.

## Hard rules

- Don't edit `projectx0` or its `gh-pages` branch.
- Don't use IAM access keys. Never commit secrets (`.env*` is git-ignored).
- Don't use the AWS CLI unless Aziz approves D1.
- Don't create a GitHub repo, push, deploy, publish or submit unless Aziz asks **in that turn**.
- Don't claim a test passed without pasted output. Don't claim deployment without an Amplify build record and a working URL.
- Never invent facts, metrics, contributions or tools. Every project claim traces to `docs/evidence-register.md`.
- Stop at every ⛔ gate in the prompt and wait for written approval.

## What's in `reference/`

| Path | What it is | Use |
|---|---|---|
| `reference/prototype/AIEngineerOS-AzizMessaoud.html` | The prototype (original name `AIEngineerOS·AzizMessaoud.html`; SHA-256 starts `0e5868e63567ca4e`). Claude generated it. | **Design input only.** Its project text, metrics, stacks, links and terminal are false or dropped (register §C). |
| `reference/prototype/*.png` | Screenshots taken 28 Oct at 1280 and 390 px (remote fonts blocked, so fallback faces show) | Stage 2 critique |
| `reference/official/event-page-copy-by-aziz-2026-10-28.txt` | Aziz's copy of the official event page | Requirements and rubric; the live page is the authority |
| `reference/official/rules-summary-by-aziz-NOT-LEGAL-TEXT.md` | Aziz's summary of the rules | Not the legal text. Aziz must read the Rules tab himself. |
| `reference/inputs/task-prompt-from-aziz.md` | Aziz's original task prompt | Intent and constraints |
| `reference/inputs/competitor-snapshot-253-participants.txt` | Ten visible competitor entries | Stage 2 distinctiveness only |
| `reference/superseded/claude-brief-SUPERSEDED.md` | Earlier Claude-written brief | **Superseded.** Contains rejected claims (HR 92.3%, terminal feature). Never reuse its text. |

## Primary sources to re-open (public)

- TraffiX: https://github.com/azizmessaoud/traffix (checked at `d54b071`) and `docs/presentation/prototype-validation.md`
- FlyRank: https://github.com/azizmessaoud/flyrank (checked at `a220b9e`): `work/capstone_report.md`, `work/notebooks/w05_model.ipynb`, `outputs/model_report.md`, `GUIDE.md`
- HR: https://github.com/azizmessaoud/hr-anomaly-detection (checked at `437a514`)
- Live site (JavaScript-rendered; use a real browser): https://azizmessaoud.github.io/projectx0/
- Event page: https://builder.aws.com/build/hackathons/3bff5627-ef21-3bfc-acfc-fce21d39a4f6/aws-student-builder-challenge-build-your-tech-superpower
- Day 1 guide: https://builder.aws.com/content/3K0hPixvikMqQ93vuL1Oyu5vym5/how-to-create-your-aws-account-and-first-project
- Day 2 guide: https://builder.aws.com/content/3LKlKCv8mLiBiKLXVGTq0TKUdLR/how-to-connect-your-coding-agent-to-aws
- Days 3 and 4: linked from the event page once published (29 and 30 Oct)

## Current state (28 Oct 2026, 22:00 Tunisia)

- Stage 1 documents: revision 2 written, **awaiting Aziz's approval**.
- Nothing is scaffolded, tested, committed or deployed.
- Open questions: D1–D7, Q8, Q9 (register §E). Stage 6 is BLOCKED until the Day 4 guide is published.
