import type { Express, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Accounts, opaque, type User } from './accounts';

const secure = () => process.env.NODE_ENV === 'production';
const options = (maxAge: number) => ({
  httpOnly: true,
  secure: secure(),
  sameSite: 'lax' as const,
  path: '/',
  maxAge,
});
export function cookie(req: Request, key: string) {
  const raw =
    req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(key + '='))
      ?.slice(key.length + 1) ?? '';
  return /^[A-Za-z0-9_-]{20,100}$/.test(raw) ? raw : '';
}
export function oauthConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.PUBLIC_URL
  );
}
export function registerAuth(app: Express, accounts: Accounts) {
  const jwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
  );
  app.use('/api', async (req, res, next) => {
    try {
      let guest = cookie(req, 'synle_guest');
      if (!guest) {
        guest = opaque();
        res.cookie('synle_guest', guest, options(365 * 86400000));
      }
      res.locals.guest = guest;
      const session = cookie(req, 'synle_session');
      res.locals.user = session ? await accounts.authenticate(session) : null;
      next();
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/auth/me', (_req, res) =>
    res.json({ user: res.locals.user, enabled: oauthConfigured() }),
  );
  app.post('/api/auth/logout', async (req, res) => {
    const session = cookie(req, 'synle_session');
    if (session) await accounts.logout(session);
    res.clearCookie('synle_session', options(0));
    res.json({ message: 'Signed out. Daily progress remains saved.' });
  });
  app.get('/api/auth/google', async (req, res) => {
    if (!oauthConfigured()) {
      res.redirect('/login?auth=unavailable');
      return;
    }
    const nonce = opaque(),
      verifier = opaque();
    const state = await accounts.flow({
      nonce,
      verifier,
      guest: res.locals.guest,
      returnTo: ['/demo', '/history'].includes(String(req.query.returnTo))
        ? String(req.query.returnTo)
        : '/history',
    });
    res.cookie('synle_oauth', state, options(600000));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.PUBLIC_URL! + '/api/auth/callback',
      response_type: 'code',
      scope: 'openid profile',
      state,
      nonce,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    // PKCE uses a base64url digest (not a hexadecimal digest).
    const { createHash } = await import('node:crypto');
    url.searchParams.set(
      'code_challenge',
      createHash('sha256').update(verifier).digest('base64url'),
    );
    res.redirect(url.toString());
  });
  app.get('/api/auth/callback', async (req, res) => {
    const fail = (reason: string) => res.redirect('/login?auth=' + reason);
    const state = cookie(req, 'synle_oauth');
    res.clearCookie('synle_oauth', options(0));
    if (!state || req.query.state !== state) {
      fail('expired');
      return;
    }
    const flow = await accounts.consumeFlow(state);
    if (!flow || flow.guest !== res.locals.guest) {
      fail('expired');
      return;
    }
    if (req.query.error) {
      fail('cancelled');
      return;
    }
    if (typeof req.query.code !== 'string' || !oauthConfigured()) {
      fail('failed');
      return;
    }
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: req.query.code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.PUBLIC_URL! + '/api/auth/callback',
          grant_type: 'authorization_code',
          code_verifier: flow.verifier,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!tokenResponse.ok) throw new Error('Token exchange failed');
      const tokens = await tokenResponse.json();
      const { payload } = await jwtVerify(tokens.id_token, jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: process.env.GOOGLE_CLIENT_ID,
        algorithms: ['RS256'],
      });
      if (payload.nonce !== flow.nonce || typeof payload.sub !== 'string')
        throw new Error('Invalid identity');
      const user = await accounts.user(
        payload.sub,
        typeof payload.name === 'string' ? payload.name : 'Word explorer',
      );
      await accounts.attach(flow.guest, user);
      const session = await accounts.session(user);
      const previous = cookie(req, 'synle_session');
      if (previous) await accounts.logout(previous);
      res.cookie('synle_session', session, options(7 * 86400000));
      res.redirect(
        (['/demo', '/history'].includes(flow.returnTo)
          ? flow.returnTo
          : '/history') + '?auth=success',
      );
    } catch {
      fail('failed');
    }
  });
  app.get('/api/history', async (req, res) => {
    const user = res.locals.user as User | null;
    if (!user) {
      res
        .status(401)
        .json({ error: 'Sign in to view your private score history.' });
      return;
    }
    const offset = Number(req.query.offset ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000) {
      res.status(400).json({ error: 'Invalid history page.' });
      return;
    }
    res.json(await accounts.history(user, offset));
  });
}
