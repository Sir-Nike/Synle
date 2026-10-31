# Project demonstration

Use the local app for a controlled presentation. Use isolated test database/browser profiles when practicing; never reset the real user's daily progress for a demonstration.

## Module one Daily game

1. Home: explain three words, five attempts, best three score. Follow Play and show the real URL. Use the replayable Demo while signed in for repeat presentations.
2. In the Demo, submit `colourful` for bright. Submit `colorful` to demonstrate a duplicate alias with no extra attempt.
3. Submit `luminouus` to demonstrate conservative correction to luminous. Submit `potato` for an incorrect answer that uses an attempt.
4. Expand All attempts, report potato as a proposed missing answer, and explain that reports are stored for review without changing published scores.
5. Refresh to restore progress. Demonstrate early-end confirmation, next word, completed results and spoiler-free sharing.
6. Use browser offline mode with a filled answer: explain the error and retained input. Reconnect, reload authoritative progress and continue.

## Module two Account and history

1. Open the dedicated /login page, or open Demo or History as a guest to show its sign-in popup. Sign in using the configured Google test account. Cancel once to demonstrate a recoverable cancellation.
2. Complete a daily game and return to History. Show date, total, round scores, personal best and days completed. Explain that the demo does not count.
3. Refresh or open a second tab and show saved state. Signing out does not create another daily game for that browser.
4. Explain ownership validation using the automated test evidence: a second authenticated identity cannot read or restore another account's game. Do not display real session cookies or OAuth secrets.
5. If OAuth credentials are not yet configured, show the unavailable message and explain that real Google sign-in has not been verified. Do not present fixture screenshots as genuine provider sign-in.

## Accessibility and testing evidence

- Tab from the address bar to Skip to main content and activate it. Navigate main links by keyboard.
- Open Settings, use arrow keys to select an appearance radio, press Escape and show restored focus.
- Resize to a 375px viewport; show no horizontal scrolling. Enable reduced motion.
- Show feedback text alongside colour and optional sound. Explain labelled inputs and live status messages.
- Run `npm test`, `npm run test:browser` and `npm run build && npm run audit:lighthouse`.
- Open ignored `test-results/browser-report/index.html` and `test-results/lighthouse/*.html`. Discuss actual results and limitations, not hypothetical scores.

## Report mapping

Site map: `/` Home; `/play` Daily game; `/demo` Replayable demo; `/results` Current results; `/history` Private account history; `/login` Sign-in and account controls; `/about` Instructions, sources and accessibility. All share navigation, typography, themes, header and footer.

Module one input is an answer string and signed progress token; the Express API validates it, loads stored daily state, matches server-side synonyms, recomputes best-three scores, saves with revision checking and returns JSON. Module two uses a Google authorization callback, validates identity, establishes a server-side session, and queries only that session's completed daily results.

Useful source excerpts: server/auth.ts (OAuth/session validation), server/accounts.ts (database constraints and owner-filtered history), server/index.ts (Zod validation and scoring endpoints), src/History.tsx (history/error states), src/App.tsx (input validation and game interface), tests/accounts.test.ts (security and persistence tests), tests/browser/game.spec.ts (user flow and axe evidence).
