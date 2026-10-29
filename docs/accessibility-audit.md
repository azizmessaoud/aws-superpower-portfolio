> **Update 29 Oct 2026:** this audit was run on 28 Oct. Since then the separate "Ask my brain" section and the page-wide pause button were removed (the terminal is now the feature, and "Ask my brain" in the nav goes to it), and certifications, a portrait and project labels were added. axe-core still reports 0 serious or critical issues, but the manual keyboard and screen-reader checks below have not been repeated. Without the pause button the site no longer meets WCAG 2.2.2 for visitors who allow motion.

## Accessibility Audit: Ask my brain portfolio (local build)
**Standard:** WCAG 2.1 AA (plus 2.2's 2.4.11 and 2.5.8 where noted) | **Date:** 29 Oct 2026
**Method:** axe-core 4.10 (wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice) at 1280 and 390 px · scripted keyboard pass (44 stops, both widths, scroll allowed to settle) · touch-target measurement · reflow at 320 px and 1280 px @ 200 % zoom · WCAG 1.4.12 text-spacing override · token contrast script · Chromium accessibility tree. **Not done:** real screen readers (VoiceOver, NVDA) and real devices.

### Summary
**Issues found:** 9 | **Critical:** 0 | **Major:** 3 | **Minor:** 6 — **all fixed** in this pass; logs in `reports/logs/` (`a11y-audit.json`, `playwright.txt`, `contrast.txt`).

### Findings

#### Perceivable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|-----|
| 1 | Docked brain was drawn over by nothing but a hidden label: an sr-only 1×1 px label punched a hole in the canvas | 1.1.1 (decorative canvas, `aria-hidden`) — visual quality only | 🟢 Minor | Scene ignores visually hidden elements when keeping out |
| 2 | axe flagged 7 contrast failures only while result cards were fading in | 1.4.3 | 🟢 Minor (transient, 300 ms) | Test waits for the entrance; settled page passes; contrast script 38/38 |

#### Operable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|-----|
| 3 | Pause control lived only in the hero, but animation now continues page-wide | 2.2.2 Pause, Stop, Hide | 🟡 Major | Pause/Play moved into the fixed nav (8th tab stop); remembered across reloads; nothing auto-resumes |
| 4 | 14 controls under 44 × 44 px (chips 36, Copy 36, logo 31×35, evidence and footer links 21–22 px tall) | 2.5.5 (AAA) / 2.5.8 (2.2 AA, 24 px) | 🟡 Major | All interactive targets ≥ 44 × 44 px; audit lists none |
| 5 | Enter on the nav "Ask my brain" link scrolled but focus did not land in the question box | 2.4.3 Focus Order | 🟡 Major | Focus moved after the browser follows the #fragment |
| 6 | Skip link offscreen when reached by wrapping from the page end | 2.4.7 Focus Visible | 🟢 Minor | Skip link is `position: fixed` |
| 7 | Brain loop kept running after docking (battery; motion not visible) | 2.2.2 / energy | 🟢 Minor | Loop runs only while the hero moves or the docked brain is hovered/focused |

#### Understandable
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|-----|
| — | None found: labels on the question input; no-result state names the problem and the recovery | 3.3.1, 3.3.2 | — | — |

#### Robust
| # | Issue | WCAG Criterion | Severity | Fix |
|---|-------|---------------|----------|-----|
| 8 | Pause button changed its label **and** used `aria-pressed` (would announce "Play motion, pressed") | 4.1.2 Name, Role, Value | 🟢 Minor | Label states the action; `aria-pressed` removed |
| 9 | Two consecutive "Ask my brain" links in the nav (list link + docked brain) | 2.4.4 / redundant tab stop | 🟢 Minor | List link removed; the docked link carries `aria-current` |

### Color Contrast Check (from `scripts/contrast-check.ts`, token values)
| Element | Foreground | Background | Ratio | Required | Pass? |
|---------|-----------|------------|-------|----------|-------|
| Body text | `--fg` #f8fafc | `--bg` #0a1929 | 16.95:1 | 4.5:1 | ✅ |
| Muted text | `--fg-muted` #94a3b8 | glass on `--surface` | 5.67:1 | 4.5:1 | ✅ |
| Violet text (labels, links) | `--violet-light` #a78bfa | glass on `--surface` | 5.35:1 | 4.5:1 | ✅ |
| Button label | white | `--blue-strong` #2563eb (gradient end) | 5.17:1 | 4.5:1 | ✅ |
| Limit / error colour | `--signal-red` #ff5f57 | glass on `--surface` | 4.87:1 | 4.5:1 | ✅ |
| Focus ring | `--violet-light` | `--surface` | 6.12:1 | 3:1 | ✅ |
| Brand violet (non-text only) | `--violet` #8b5cf6 | `--bg` | 4.19:1 | 3:1 | ✅ (not used for text) |

### Keyboard Navigation
| Element | Tab Order | Enter/Space | Escape | Arrow Keys |
|---------|-----------|-------------|--------|------------|
| Skip to content | 1 | jumps to main | — | — |
| Nav links | 2–6 | scroll + focus the section | closes phone menu | — |
| Pause / Play motion | 7–8 | toggles all scene motion | — | — |
| Ask my brain (docked brain) | 9 | scroll + focus the question box | — | — |
| Phone menu button | (≤760 px) | opens/closes; `aria-expanded` | closes, returns focus | — |
| Question input | in Ask section | submits | — | — |
| Suggested questions | after input | runs the question; `aria-pressed` marks the current one | — | — |
All 44 stops at 1280 and 390 px land fully in view, with a 2 px violet ring, not under the fixed nav, not covered.

### Screen Reader (Chromium accessibility tree; real AT not tested)
| Element | Announced As | Issue |
|---------|-------------|-------|
| Nav | navigation "Main" with list of 4 links, button "Pause motion", link "Ask my brain" | none after fixes 8–9 |
| Canvas | hidden (`aria-hidden`) | everything it shows is also in page text |
| Ask my brain | region "Ask my brain" → search landmark → searchbox "Your question" | none |
| No result | status "No verified passage answers that question." + heading | none |

### Priority Fixes (done)
1. **Page-wide pause** — affects anyone distracted or harmed by motion; required once motion leaves the hero.
2. **44 px targets** — affects touch and motor-impaired users on every section.
3. **Focus lands in the question box** — affects keyboard and screen-reader users of the creative feature.

### Still to do
- Test with VoiceOver (iOS/macOS) and NVDA (Windows) on a real device.
- Long focus jumps animate slowly on phones because of `scroll-behavior: smooth` (≈1 s for a 5,000 px jump); consider instant scrolling for focus-driven jumps.
