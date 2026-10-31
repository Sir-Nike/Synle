import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

type Identity = { user: { id: string; name: string } | null; enabled: boolean };
type History = {
  entries: {
    challengeId: string;
    date: string;
    number: number;
    version: string;
    total: number;
    rounds: { word: string; score: number }[];
  }[];
  hasMore: boolean;
  days: number;
  best: number;
};
const authMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. Your game is still saved.',
  expired: 'That sign-in link expired. Please try again.',
  failed: 'We couldn’t finish signing you in. Your game is still saved.',
  success:
    'You’re signed in. Your saved daily games are linked to your account.',
  unavailable:
    'Sign-in is currently unavailable. You can still play as a guest.',
};
export default function HistoryPage({
  play,
  expired,
  signedOut,
}: {
  play: () => void;
  expired: () => void;
  signedOut: () => void;
}) {
  const [identity, setIdentity] = useState<Identity>();
  const [history, setHistory] = useState<History>();
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(
    () =>
      authMessages[new URLSearchParams(location.search).get('auth') ?? ''] ??
      '',
  );
  async function load(page = offset) {
    setBusy(true);
    setError('');
    try {
      const me = await api<Identity>('auth/me');
      setIdentity(me);
      if (me.user) setHistory(await api<History>(`history?offset=${page}`));
      else {
        setHistory(undefined);
        expired();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setIdentity((i) => (i ? { ...i, user: null } : i));
        setHistory(undefined);
        setMessage('Your session expired. Sign in again to view history.');
        expired();
      } else
        setError(e instanceof Error ? e.message : 'Could not load history.');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load(offset);
  }, [offset]);
  async function logout() {
    setBusy(true);
    try {
      await api('auth/logout', {});
      setHistory(undefined);
      setIdentity((i) => (i ? { ...i, user: null } : i));
      setMessage('Signed out. Your daily game remains saved in this browser.');
      signedOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-page" aria-busy={busy}>
      <p className="panel-label">Your word journal</p>
      <h1 tabIndex={-1}>Good words add up.</h1>
      <p className="page-lede">A little history of your daily discoveries.</p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button className="text-button" onClick={() => void load()}>
            Retry history
          </button>
        </div>
      )}
      {!identity && !error && <p role="status">Loading your account…</p>}
      {identity?.user && (
        <>
          <div className="account-identity">
            <p>
              Signed in as <strong>{identity.user.name}</strong>
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
          {history && (
            <>
              <dl className="history-stats">
                <div>
                  <dt>Days completed</dt>
                  <dd>{history.days}</dd>
                </div>
                <div>
                  <dt>Personal best</dt>
                  <dd>
                    {history.best}
                    <small> / 900</small>
                  </dd>
                </div>
              </dl>
              <h2>Daily score history</h2>
              <p className="small">
                Completed daily games only. Demo scores stay separate.
              </p>
              {history.entries.length === 0 ? (
                <div className="account-card">
                  <h3>Your first page is waiting.</h3>
                  <p>Complete a daily challenge to see its score here.</p>
                  <button className="button primary" onClick={play}>
                    Play today
                  </button>
                </div>
              ) : (
                <ol className="score-history">
                  {history.entries.map((entry) => (
                    <li key={entry.challengeId}>
                      <details>
                        <summary>
                          <span>
                            <time dateTime={entry.date}>
                              {new Intl.DateTimeFormat('en', {
                                dateStyle: 'medium',
                                timeZone: 'Asia/Kolkata',
                              }).format(
                                new Date(entry.date + 'T12:00:00+05:30'),
                              )}
                            </time>
                            <small>
                              Challenge #{entry.number} · Round details
                            </small>
                          </span>
                          <strong>
                            {entry.total}
                            <small> / 900</small>
                          </strong>
                        </summary>
                        <dl>
                          {entry.rounds.map((r) => (
                            <div key={r.word}>
                              <dt>{r.word}</dt>
                              <dd>{r.score} / 300</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
              <nav className="history-pagination" aria-label="History pages">
                <button
                  className="button secondary"
                  disabled={!offset || busy}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  Newer
                </button>
                <span>Page {offset / 30 + 1}</span>
                <button
                  className="button secondary"
                  disabled={!history.hasMore || busy}
                  onClick={() => setOffset(offset + 30)}
                >
                  Older
                </button>
              </nav>
            </>
          )}
        </>
      )}
      <p className="privacy-note">
        History is private to your account. We store your Google account
        identifier, display name and daily game progress. We don’t request your
        password or access to your email. On a shared device, sign out when
        finished; this browser can still resume its current daily game.
      </p>
    </section>
  );
}
