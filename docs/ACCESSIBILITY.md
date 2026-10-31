# Accessibility and testing assessment

Synle targets WCAG 2.2 Level AA. Automated results are evidence of the tested states, not a claim of full WCAG conformance. The implementation and verification below were completed locally on October 31, 2026; the update is now live on Render. The automated accessibility measurements below describe the local build.

## Implemented support

| Requirement | Implementation and evidence |
|---|---|
| Keyboard access and focus (2.1.1, 2.4.3, 2.4.7) | Native buttons/links/forms, visible focus, a skip-to-main link, route-title focus, native dialog focus containment and Escape dismissal. Browser tests exercise keyboard skip navigation, appearance radios and restored focus. |
| Contrast and colour (1.4.1, 1.4.3) | Semantic light/dark palettes; acceptance and rarity include text as well as colour. axe found insufficient light-theme empty-slot contrast (4.01:1); the subtle-text colour was darkened and repeat checks pass. |
| Labels and errors (3.3.1, 3.3.2, 4.1.2) | Visible answer label, maximum-length instructions, required input, server-side length/schema checks, named icon controls, alert errors and polite live feedback. |
| Status messages (4.1.3) | Submission feedback, reporting results and authentication status use status/alert roles. Busy and disabled states prevent repeat submissions. Live timers are not repeatedly announced. |
| Reflow (1.4.10) | Responsive layout and mobile viewport metadata; 375px mobile tests check horizontal overflow; extended checks also cover 320 CSS pixels on Home, Login and About, 400% CSS zoom on Login, and Firefox at a 390px viewport. Browser zoom is not disabled. Native browser 400% zoom and a spoken assistive-device review are not claimed by the CSS zoom check. |
| Motion and audio | Reduced-motion media rules, no timed gameplay, sound off by default and controllable. All scoring feedback is also available visually. |
| Accessible authentication (3.3.8) | Google sign-in avoids a locally imposed memory puzzle or manual credential form. Synle requests identity/profile only. Google controls its own authentication screens; they are outside this local audit. |
| Predictable navigation | Shared Home, Play, History and How to Play navigation, dedicated /login page, persistent URLs and tested back/refresh behavior. Home and daily play are public. Demo and History require sign-in; an accessible dialog explains why and can be cancelled. |

## Automated checks

- `npm test`: scoring, signed progress, API validation, cookie sessions, private history, PKCE/state/nonce construction, cancellation/replay rejection, daily uniqueness, cross-account denial, concurrent-tab conflicts, guest migration, database failure/recovery and demo separation.
- `npm run test:browser`: production-build user flows through Playwright and axe-core in light/dark themes, sign-in dialogs, guest route gating, history rendering, offline recovery, focus, mobile layout and reduced-motion mode. It uses an isolated test-only launcher to seed a session in a separate database; there is no test login route in the production app. Some display-state cases mock history responses. No real Google credentials or production data are used by automation.
- `npm run build && npm run audit:lighthouse`: mobile Lighthouse checks for performance, accessibility, best practices and SEO. Reports are in ignored `test-results/lighthouse/`. These reports use an unauthenticated browser; protected Demo/History therefore cover the sign-in dialog, while authenticated screen accessibility is covered by the Playwright/axe suite.
- Browser HTML report: ignored `test-results/browser-report/index.html`; per-screen axe JSON is stored with each browser test's output.

The latest exact counts and Lighthouse scores are recorded in `docs/TEST-RESULTS.md`. Scores are local measurements and can vary with machine load. Browser reports include axe incomplete/manual-review items that must not be interpreted as passes.

## Manual and real-provider verification

The browser checks cover keyboard navigation, skip link activation, dialog cancellation/focus return, theme persistence, 375px layout and reduced-motion preference. Screenshots were inspected during development. The user completed Google sign-in locally; a user record and active sessions were confirmed in the local database without exposing credentials. Real Google sign-in is separate from seeded test sessions.

A dedicated screen-reader assessment, 400% zoom, multiple desktop/mobile browsers and testing with users with disabilities remain recommended. Database schema support exists for PostgreSQL, but this change has not been deployed to or retested against the hosted database. The user elected to retain the existing Render database for now.

Reference: https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/WCAG22/quickref/ .
