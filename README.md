# Synle

A full-stack daily synonym game. Three words, five attempts each; your best three answers per word count. React/TypeScript frontend, Express API, signed browser progress, SQLite locally and PostgreSQL for accounts, daily progress, reports and metrics.

## Run locally

Requires Node **22.13+** (tested on 22.23.1).

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies API calls to port 3001. No API keys, paid services, or Python are required for daily guest play. Google OAuth client credentials are required for the protected demo and history. SQLite is created automatically in `data/synle.db`. Node 22 may print an experimental SQLite notice.

**Appearance:** Settings → Light, Dark or Device. The selection survives refreshes; Device follows operating-system changes. The theme is applied before the page paints, including the browser's theme colour. Both palettes cover gameplay, dialogs, results, errors and rarity badges.

Production / local presentation fallback:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. This also works without internet after installation: fonts and sounds are local. The replayable **demo** remains available to signed-in users outside the published schedule. New Google sign-in requires internet. For sign-in on this port, set PUBLIC_URL=http://localhost:3001 and register http://localhost:3001/api/auth/callback with Google.

## Checks

```sh
npm test
npm run content:check
npm run build
```

See [SPEC.md](SPEC.md) for the agreed rules and [docs/CONTENT.md](docs/CONTENT.md) for content preparation, attribution and remaining editorial limitations.

## Free Render deployment

1. Put this folder in a Git repository and push to your own GitHub account.
2. Create a Render Node web service from that repository; choose **Free**.
3. Build command: `npm ci --include=dev && npm run build`. Start command: `npm start`. Health endpoint: `/api/health`. Build-time tools must be included even when `NODE_ENV=production`.
4. Set `NODE_ENV=production`, `NODE_VERSION=22.23.1`, and a **stable** `SESSION_SECRET` (at least 32 characters). Generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; paste into Render's secret environment field, never into Git.
5. For durable accounts, progress, reports and metrics, set `DATABASE_URL` to a PostgreSQL connection URL supplied by your chosen provider. Use its recommended TLS parameters (e.g. `sslmode=require`), do not disable certificate checks. Tables are created automatically.
6. Recommended: use the included `render.yaml` as a Blueprint. It creates a free web service and free PostgreSQL database in Singapore, generates the session secret, and supplies the internal database URL automatically. Database connections from the public internet are disabled. Both resources explicitly use the Free plan; the database expires after 30 days.
7. Verify the scheduled dates before presenting. Load the hosted app once before the demo, then keep the local fallback available.

Render free services use **temporary disk** and sleep after inactivity. With no `DATABASE_URL`, SQLite accounts, sessions and progress may disappear after a restart on ephemeral hosting. Use PostgreSQL for hosted accounts and history; browser tokens alone are not sufficient for durable account state. Render's free PostgreSQL offering expires after 30 days; do not treat it as permanent storage. See [Render's free-service documentation](https://render.com/docs/free). The existing deployment uses Render free web hosting and PostgreSQL.

## How it works

- `content/bank-v1.json`, `content/bank-v2.json`: versioned server-only answer banks; do not put in `public/` or import into frontend runtime code. October 30 keeps v1; the revised demo and later scheduled days use v2.
- `content/schedule.json`: explicit date-to-challenge mapping, in India Standard Time.
- `server/game.ts`: canonical answers, conservative typo handling, best-three scoring, signed progress and public views.
- `server/index.ts`: validated API, rate limits, profanity filtering and same-origin write checks.
- `server/storage.ts`: local SQLite / optional PostgreSQL adapters for reports and minimal events.
- `src/`: accessible game flow, results, help, settings and synthesized optional audio.

The signed progress token contains only submitted attempts and state, not the answer bank. All scoring is recomputed from server content. Daily tokens now refer to owner-bound database state with revision checks; demos remain replayable. Guest cookies provide a casual restriction, not competitive anti-cheat. Reports are explicit submissions; no names, email addresses or raw IPs are stored in application analytics. Separate account records contain Google identifiers and display names, as described on History. Metrics failures do not block gameplay.

## Presentation checklist

- Run the three checks above.
- Play the demo once, including a typo, duplicate, invalid answer, and ending a round early.
- Refresh during a round to demonstrate recovery.
- Try a narrow mobile viewport and keyboard-only navigation.
- Enable sounds and preview them in settings; they are off initially.
- Verify the daily challenge date and the midnight IST reset countdown.
- Keep `npm start` ready locally in case hosted service/network access is unavailable.

## Data review

There is no public administration page. Review local reports with a SQLite viewer or the provider's PostgreSQL console. Table names are `reports`/`events` locally and `synle_reports`/`synle_events` in PostgreSQL. Reports do not alter existing scores automatically. Create a new bank version for future scoring changes and retain older banks while their challenges can be restored.

## Accounts and project assessment

Google sign-in, server-persisted daily progress, and private score history are now implemented. Home and daily guest play remain available when OAuth credentials are absent; Demo and History require sign-in through a popup or the dedicated /login page. See [account setup](docs/ACCOUNTS.md) for environment variables and Google redirect URIs. The existing Render database is retained; no paid service or replacement database is provisioned.

New URLs: `/play`, `/demo`, `/results`, `/history`, `/login` and `/about`, with browser back/forward support and shared navigation. Daily results are calculated on the server and saved once per owner/challenge with revision checks. History includes completed daily totals, round scores, personal best and completed days; demo scores stay separate.

Verification:

```sh
npm test
npm run test:browser
npm run build
npm run audit:lighthouse
```

Browser tests and local audits use the Brave executable at `/usr/bin/brave-browser`; set BROWSER_PATH to a compatible Chromium executable on another machine. The browser suite and Lighthouse start isolated production servers with isolated test databases. Reports and screenshots are written to ignored `test-results/`. Run the build before Lighthouse so its static files reflect current sources. No external AI or billable inference calls are involved.

See [demonstration and report mapping](docs/DEMONSTRATION.md) and [accessibility assessment](docs/ACCESSIBILITY.md). Real Google sign-in was confirmed locally by the user on October 31, 2026. Automated tests seed isolated local sessions or mock history responses and do not impersonate a production login. The account/history update is live on Render. Production Google sign-in, score history, refresh persistence, logout protection and fresh sign-in were verified on October 31, 2026.
