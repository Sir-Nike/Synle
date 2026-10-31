# Accounts and score history

Home and the daily game support guest play. The replayable demo and private History require Google OpenID Connect sign-in. A dedicated /login page provides sign-in and account controls; protected navigation opens an accessible sign-in dialog for guests. Direct protected API requests return 401. OAuth is used for authentication only; no generative AI service is used.

## Google setup

1. Create or select a project in https://console.cloud.google.com/ . No billing account is required for Google sign-in.
2. In Google Auth Platform, configure Branding (app name Synle and your support/developer contact), Audience (External), and add your Google account as a test user while the app is in testing.
3. Under Clients, create an OAuth client of type Web application. Use the exact authorized redirect URI `http://localhost:5173/api/auth/callback` for local development. For deployment add `https://synle.onrender.com/api/auth/callback`. Do not use JavaScript API keys or Gemini keys.
4. Save GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL in local `.env`. PUBLIC_URL is the application origin without a trailing slash: `http://localhost:5173` locally, `https://synle.onrender.com` on Render. Restart the API after editing `.env`.
5. On Render, enter these same three variables in the service environment (production PUBLIC_URL). Keep SESSION_SECRET stable. Never put client secrets in VITE_ variables, Git, screenshots or the frontend bundle.
6. Start from /login, or open Demo or History as a guest and choose Continue with Google in the dialog. Approve sign-in, complete a daily game, confirm its history entry, sign out, and sign in again. Test cancellation too. The user confirmed successful real Google sign-in locally on October 31, 2026; local database inspection confirmed a user record and active sessions. Automated tests seed isolated sessions and do not claim to authenticate with Google. The live Render service has not been updated.

The app requests only `openid profile`. The intended destination (/demo or /history) is stored with the one-use flow; other return URLs are rejected by an allowlist. Google redirects to the backend, which exchanges the authorization code using PKCE, verifies the ID token signature with Google's JWKS, validates issuer/audience/expiry/nonce, and creates a local session. No Google access or refresh token is retained. A random state value is stored server-side and bound to an HttpOnly browser cookie, expires after ten minutes, and is consumed once. Sessions are random opaque values, hashed in the database, expire in seven days and are revoked by logout. Production cookies are Secure, HttpOnly and SameSite=Lax.

## Daily game rules

Daily games are stored under a guest browser identity or authenticated account and challenge ID. A composite primary key prevents a second row for the same owner/challenge. Each write compares the saved revision, so concurrent tabs cannot overwrite one another. The server calculates scores from its own answer bank; client totals are never accepted. Restore loads the latest database state. Old signed browser progress can be imported if there is no stored game for that identity and challenge. Existing canonical state always wins.

On login, guest games join the account only for dates the account has not played. If both exist, the account game takes priority. This avoids replacing an existing score with a guest retry. The browser is linked to those account challenges so signing out does not reset its daily attempts. Only a valid signed-in session can access history; a guest link allows resuming gameplay, not viewing account history. Clearing all cookies or using another identity can bypass guest restrictions; this is a casual game, not verified competitive anti-cheat.

Completed daily rows retain date, challenge number, bank version, total and round breakdown. History is paginated at thirty rows, newest first, with total days completed and personal best computed across all completed daily games. Demo games never enter history. There is no public leaderboard.

## Database

New tables are created idempotently in the existing database: synle_users, synle_sessions, synle_oauth, synle_plays and synle_guest_links, plus a history index. Existing reports and events are preserved. SQLite is used locally; DATABASE_URL enables PostgreSQL. No new hosted database has been provisioned. The user elected to keep the current Render database for now; its original thirty-day expiry still applies. Before expiry, back up and migrate data or update hosting. Do not silently replace DATABASE_URL or drop the existing database.

## Errors and privacy

Login cancellation and expired states return explanatory History messages. Unauthenticated or expired history requests return 401; invalid pagination returns 400; foreign-game access returns 403; stale game writes return 409; database failures return 503 without logging secrets. A lost network response can leave an action's outcome uncertain: keep the input and restore authoritative progress before retrying.

The database stores the Google subject identifier, display name and game progress. The app does not request the user's password or email access. Cookie identities persist on shared devices; sign out and take account of the displayed shared-browser notice. Formal deletion/export features are future scope.

References: https://developers.google.com/identity/openid-connect/openid-connect and https://developers.google.com/identity/openid-connect/reference .
