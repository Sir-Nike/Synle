# Local verification results

Verified October 31, 2026 against the current local production build. This update is not deployed to Render.

- TypeScript/build: passed (also run by the production browser suite).
- Unit and real HTTP API tests: **23 passed, zero failures/skips**.
- Playwright browser tests: **17 passed**, including ten light/dark authenticated-screen axe checks, two guest sign-in-page axe checks, and a guest access/dialog flow with axe.
- Content structure: **551 expressions across retained v1/v2 banks, 33 scheduled daily challenges**. This counts expressions across versions, not unique synonyms. Content coverage is finite.
- Dependency audit: **zero known vulnerabilities** at the time of the run.
- Source scan: no configured secret values found in tracked/new source files. Local .env and test artifacts are Git-ignored.

## Lighthouse mobile measurements

| Screen | Performance | Accessibility | Best practices | SEO |
|---|---:|---:|---:|---:|
| home | 88 | 100 | 100 | 100 |
| about | 86 | 100 | 100 | 100 |
| login | 87 | 100 | 100 | 100 |
| history | 86 | 100 | 100 | 100 |
| demo | 88 | 100 | 100 | 100 |

These are local single-run measurements; performance varies with machine load. The Lighthouse browser is unauthenticated: Demo and History measurements cover their sign-in dialogs. Authenticated Demo and History are separately checked by axe in the browser suite. Accessibility scores are not a WCAG conformance certification. Detailed HTML/JSON reports live in ignored test-results/lighthouse/ and test-results/browser-report/.

## Functional and security evidence

The real API tests exercise schema/length validation, tampered signed progress, synonyms and typo handling, reporting, session-required history and demo access, cross-account game denial, daily restart prevention, stale concurrent requests, forged client totals, completed score history, demo exclusion, logout revocation, guest merging with canonical account precedence, and database lock/failure recovery without consuming an attempt. OAuth tests check state/nonce/PKCE construction and one-use cancellation state without calling Google.

Browser tests cover demo gameplay, duplicate aliases, correction, answer reporting, early-end cancellation/confirmation, results URLs, refresh/restore, back navigation, offline input preservation, history round breakdowns, expired sessions, sign-in page and popup access rules, mobile overflow, skip navigation, dialog focus and saved appearance. Seeded sessions and mocked history are isolated fixtures, not real provider logins.

The user separately completed Google sign-in on localhost and returned to /history?auth=success. Inspection confirmed a local user and active sessions. No real user's daily challenge was consumed by automation. Full PostgreSQL deployment verification, a dedicated screen-reader review and wider browser/device testing remain outstanding.

## Reproduce

npm test
npm run test:browser
npm run content:check
npm run build
npm run audit:lighthouse

The browser and Lighthouse tools use /usr/bin/brave-browser by default; override BROWSER_PATH on another machine. No paid inference API is used.

Extended checks: Firefox 157 scoring, refresh restoration and history passed at a 390px mobile viewport. Home, Login and About pass 320 CSS-pixel reflow checks; Login also passes 400% CSS zoom without horizontal overflow. CSS zoom is not native browser zoom. The semantic accessibility tree exposes labelled controls and status feedback; this is not a spoken screen-reader assessment. See ignored test-results/report-qa/summary.json.
