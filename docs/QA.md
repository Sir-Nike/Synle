# Initial build verification

Verified locally on October 30, 2026 with Node 22.23.1.

## Automated

- `npm run build`: TypeScript validation and production bundle pass.
- `npm test`: 13 tests pass, including a real HTTP API test server.
- `npm run content:check`: 268 answers and four scheduled challenges pass schema/rule checks.

Coverage: meanings, British/American aliases, duplicate canonical answers, five-attempt cap, best-three replacement, invalid answers, conservative correction, ambiguous suggestions, real-word correction guard, signed progress tampering, unrevealed-bank protection, early finish, completed-game rejection and midnight IST reset. API checks also cover input limits, cross-origin writes, reporting and restored scoring.

## Browser

Headless Brave/Chromium through agent-browser:

- Desktop welcome and full demo, including `astute`, `colourful`, duplicate `colorful`, typo `luminouus`, invalid `potato`, and replacement by `resplendent`.
- Correct 300-point best-three total and round summary.
- Explicit next-round navigation; confirmation before early finishing remaining rounds.
- Final results and successful clipboard copy after bringing the action into view.
- Mobile 390px-wide layout, a daily accepted answer, and refresh restoring the score/attempts and input focus. No horizontal page overflow.
- Settings dialog, sound-preview trigger and Escape dismissal without browser errors. Audio is synthesized; subjective listening/tuning remains a user review task.
- Production server health response, static HTML and security headers checked separately from Vite development serving.

Screenshots live in the ignored `test-results/` folder for local review.

## Accessibility checks

Main text/background contrast: 12.41:1; secondary text/background: 5.66:1; primary button text: 6.41:1; success/error feedback: 5.74:1 / 5.82:1. Rarity badge text combinations exceed 6:1. Input boundary strengthened to 3.85:1 against white. Labels, keyboard submission, dialog focus containment, textual rarity/feedback and reduced-motion CSS are implemented. This is not a formal WCAG audit.

## Follow-up playtest and appearance

See [PLAYTEST.md](PLAYTEST.md) for the subsequent 100-case content playtest, versioned answer-bank revision and dark-theme work. The suite now has 18 passing tests; the original 13-test result above describes the first build. Content validation now checks 551 entries across both retained bank versions (268 in v1, 283 in v2), rather than 551 distinct expressions.

The follow-up also exercised offline submission/retry without consuming attempts, damaged display-index recovery, full dark gameplay, early-end cancellation/confirmation and real clipboard writing. Dark-mode contrast checks are recorded in the playtest report.

## Remaining verification

- Listen to sound previews and tune their subjective volume/tone.
- Conduct human difficulty playtests; v2 rarity has been calibrated during the agent playtest, but subjective familiarity still varies.
- Verify individual editorial dictionary references and broaden regional expressions as needed.
- Hosted PostgreSQL adapter and actual Render deployment require user-provisioned infrastructure and have not been exercised against a live remote database.
- Check schedule dates before presentation; no daily prompts are scheduled after November 2, 2026.
