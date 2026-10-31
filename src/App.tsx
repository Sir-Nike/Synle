import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Flag,
  LoaderCircle,
  Monitor,
  Moon,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  Feedback,
  GameView,
  PublicRound,
  ScoredAttempt,
  Tier,
} from '../server/types';
import { playSound, stopSound, unlockSound, type Sound } from './sound';
import { applyTheme, readTheme, type Theme } from './theme';
import { api, ApiError } from './api';
import HistoryPage from './History';

type Meta = {
  available: boolean;
  date: string;
  number?: number;
  challengeId?: string;
  nextReset: string;
};
type Mode = 'daily' | 'demo';
type Identity = { user: { id: string; name: string } | null; enabled: boolean };
type Saved = { token: string; selected: number; results: boolean };
const tierNames: Record<Tier, string> = {
  familiar: 'Familiar',
  uncommon: 'Uncommon',
  rare: 'Rare',
};
function getLocal(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function putLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
const saveKey = (date: string, mode: Mode) =>
  `synle:${mode}:${mode === 'demo' ? 'v2' : date}`;
function restoredRound(saved: Saved, game: GameView) {
  return Number.isInteger(saved.selected) &&
    saved.selected >= 0 &&
    saved.selected < game.rounds.length
    ? saved.selected
    : game.currentRound;
}
function Marks({ tier }: { tier: Tier }) {
  return (
    <span className={`rarity-marks ${tier}`} aria-hidden="true">
      {tier === 'rare' ? (
        <Sparkles size={14} />
      ) : (
        <>
          <i />
          {tier === 'uncommon' && <i />}
        </>
      )}
    </span>
  );
}
function Badge({ tier }: { tier: Tier }) {
  return (
    <span className={`badge ${tier}`}>
      <Marks tier={tier} />
      {tierNames[tier]}
    </span>
  );
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const previousPath = location.pathname;
    dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        if (location.pathname === previousPath)
          previous?.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  return (
    <span className="countdown">
      {left === 0
        ? 'New challenge ready — reload to play'
        : `${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(Math.floor(left / 60) % 60).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`}
    </span>
  );
}

export default function App() {
  const [meta, setMeta] = useState<Meta>();
  const [game, setGame] = useState<GameView>();
  const [mode, setMode] = useState<Mode>('daily');
  const [scene, setSceneState] = useState<'welcome' | 'game' | 'results'>(
    'welcome',
  );
  const [page, setPage] = useState(location.pathname);
  const [identity, setIdentity] = useState<Identity>();
  const [loginTarget, setLoginTarget] = useState('/history');
  function requireLogin(target: string) {
    setLoginTarget(target);
    setModal('login');
  }
  function dismissLogin() {
    setModal(null);
    if (['/history', '/demo', '/results'].includes(page)) {
      navigate('/');
      setSceneState('welcome');
    }
  }
  function navigate(path: string) {
    if (location.pathname !== path) history.pushState({}, '', path);
    setPage(path);
  }
  function setScene(next: 'welcome' | 'game' | 'results') {
    setSceneState(next);
    navigate(
      next === 'welcome'
        ? '/'
        : next === 'results'
          ? '/results'
          : mode === 'demo'
            ? '/demo'
            : '/play',
    );
  }
  const [selected, setSelected] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(() => getLocal('synle:sound') === 'on');
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [modal, setModal] = useState<
    'help' | 'settings' | 'end' | 'sources' | 'login' | null
  >(null);
  const [reportMessage, setReportMessage] = useState('');
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [storageWarning, setStorageWarning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canRestore, setCanRestore] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const round = game?.rounds[selected];

  async function initialise() {
    setLoading(true);
    setError('');
    try {
      const me = await api<Identity>('auth/me');
      setIdentity(me);
      const metadata = await api<Meta>('challenge');
      setMeta(metadata);
      const lastMode: Mode =
        getLocal('synle:last-mode') === 'demo' ? 'demo' : 'daily';
      const cached = getLocal(saveKey(metadata.date, lastMode));
      if (
        cached &&
        (lastMode !== 'demo' || me.user) &&
        ['/play', '/demo', '/results'].includes(location.pathname)
      ) {
        let saved: Saved | undefined;
        try {
          saved = JSON.parse(cached);
        } catch {
          /* Ignore damaged local JSON. */
        }
        if (saved?.token) {
          try {
            const restored = await api<{ game: GameView }>('restore', {
              token: saved.token,
            });
            setMode(lastMode);
            setGame(restored.game);
            setSelected(restoredRound(saved, restored.game));
            setSceneState(
              saved.results && restored.game.complete ? 'results' : 'game',
            );
          } catch (err) {
            setError(
              `${err instanceof Error ? err.message : 'Couldn’t restore progress.'} Your saved copy has been kept.`,
            );
            setCanRestore(
              !(err instanceof ApiError && [400, 410].includes(err.status)),
            );
          }
        }
      }
    } catch {
      setError(
        'Couldn’t reach Synle. If the server is waking up, give it a moment and retry.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void initialise();
  }, []);
  useEffect(() => {
    const onPop = () => setPage(location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (!loading && identity && !identity.user && page === '/history') {
      requireLogin('/history');
      return;
    }
    if (!loading && meta && ['/play', '/demo', '/results'].includes(page))
      void start(
        page === '/demo'
          ? 'demo'
          : page === '/results' && getLocal('synle:last-mode') === 'demo'
            ? 'demo'
            : 'daily',
      );
  }, [page, loading, meta?.date, identity?.user?.id]);
  useEffect(() => {
    document.title = `${page === '/login' ? 'Sign in' : page === '/history' ? 'Score history' : page === '/about' ? 'How to play' : page === '/play' ? 'Daily game' : page === '/demo' ? 'Demo' : page === '/results' ? 'Results' : 'Daily synonym game'} · Synle`;
    if (page === '/history' || page === '/about' || page === '/login')
      document.querySelector<HTMLElement>('#main-content h1')?.focus();
  }, [page]);
  useEffect(() => {
    const update = () => applyTheme(theme);
    update();
    putLocal('synle:theme', theme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);
  useEffect(() => {
    if (!game) return;
    const ok = putLocal(
      saveKey(game.date, mode),
      JSON.stringify({
        token: game.token,
        selected,
        results: scene === 'results',
      }),
    );
    if (!ok) setStorageWarning(true);
  }, [game, selected, scene, mode]);
  useEffect(() => {
    if (scene === 'game' && round && !round.ended && !busy && !modal)
      input.current?.focus({ preventScroll: true });
  }, [scene, selected, busy, modal, round?.ended]);
  useEffect(() => {
    if (scene === 'results') heading.current?.focus();
  }, [scene]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [scene, selected]);

  const soundFor = (s: Sound) => {
    if (sound) playSound(s);
  };
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    putLocal('synle:sound', enabled ? 'on' : 'off');
    if (enabled) {
      unlockSound();
    } else stopSound();
  }
  async function start(nextMode: Mode, restart = false) {
    if (nextMode === 'demo' && !identity?.user) {
      requireLogin('/demo');
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setFeedback(undefined);
    setAnswer('');
    if (sound) unlockSound();
    try {
      let saved: Saved | undefined;
      if (!restart && meta && (nextMode === 'demo' || canRestore)) {
        try {
          const raw = getLocal(saveKey(meta.date, nextMode));
          if (raw) saved = JSON.parse(raw);
        } catch {
          /* Invalid local value. */
        }
      }
      let response: { game: GameView };
      if (saved?.token) {
        try {
          response = await api<{ game: GameView }>('restore', {
            token: saved.token,
          });
        } catch (err) {
          if (err instanceof ApiError && [400, 403, 410].includes(err.status))
            response = await api<{ game: GameView }>('start', {
              mode: nextMode,
            });
          else throw err;
        }
      } else
        response = await api<{ game: GameView }>('start', { mode: nextMode });
      setMode(nextMode);
      putLocal('synle:last-mode', nextMode);
      setGame(response.game);
      setSelected(
        saved
          ? restoredRound(saved, response.game)
          : response.game.currentRound,
      );
      setSceneState(response.game.complete ? 'results' : 'game');
      navigate(
        response.game.complete
          ? '/results'
          : nextMode === 'demo'
            ? '/demo'
            : '/play',
      );
      setCanRestore(true);
      setReported(new Set());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIdentity((i) => (i ? { ...i, user: null } : i));
        requireLogin('/demo');
      } else
        setError(
          err instanceof Error ? err.message : 'Couldn’t start. Try again.',
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function check(event?: FormEvent, suggestion?: string) {
    event?.preventDefault();
    const text = (suggestion || answer).trim();
    if (text.length > 80) {
      setError('Use at most 80 characters.');
      return;
    }
    if (!text) {
      setError('Enter a word or established phrase.');
      return;
    }
    if (!game || !round || round.ended || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setReportMessage('');
    setFeedback(undefined);
    if (sound) unlockSound();
    try {
      const response = await api<{ game: GameView; feedback: Feedback }>(
        'answer',
        { token: game.token, answer: text },
      );
      setGame(response.game);
      setFeedback(response.feedback);
      if (response.feedback.kind !== 'suggestions') setAnswer('');
      const ended = response.game.rounds[selected].ended;
      if (ended) soundFor(response.game.complete ? 'complete' : 'round');
      else if (response.feedback.kind === 'accepted')
        soundFor(response.feedback.tier!);
      else if (response.feedback.kind === 'incorrect') soundFor('incorrect');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setIdentity((i) => (i ? { ...i, user: null } : i));
        requireLogin('/demo');
      }
      setError(
        err instanceof Error
          ? err.message
          : 'Could not confirm your answer. Your input is kept.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function finishRound() {
    if (!game || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await api<{ game: GameView }>('end-round', {
        token: game.token,
      });
      setGame(response.game);
      setFeedback(undefined);
      setAnswer('');
      setModal(null);
      soundFor(response.game.complete ? 'complete' : 'round');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Couldn’t end the round.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function advance() {
    setFeedback(undefined);
    setReportMessage('');
    setError('');
    setAnswer('');
    if (selected === 2) setScene('results');
    else setSelected(selected + 1);
  }
  async function report(index: number) {
    if (!game) return;
    const key = `${selected}:${index}`;
    if (reported.has(key)) return;
    setReported((prev) => new Set([...prev, key]));
    try {
      const response = await api<{ message: string }>('report', {
        token: game.token,
        roundIndex: selected,
        attemptIndex: index,
      });
      setReportMessage(response.message);
    } catch (err) {
      setReported((prev) => {
        const n = new Set(prev);
        n.delete(key);
        return n;
      });
      setReportMessage(
        err instanceof Error ? err.message : 'Couldn’t report. Try again.',
      );
    }
  }
  async function share() {
    if (!game) return;
    const text = `Synle ${mode === 'demo' ? 'Demo' : `#${game.number}`}\n${game.rounds.map((r) => `${r.best.map((a) => (a.tier === 'rare' ? '🟨' : a.tier === 'uncommon' ? '🟦' : '⬜')).join('')}${'▫️'.repeat(3 - r.best.length)} ${r.score}/300`).join('\n')}\n${game.total}/900\n${location.origin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(
        'Copy isn’t available in this browser. You can select and copy your score instead.',
      );
    }
  }
  const dateText = meta
    ? new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(new Date(`${meta.date}T12:00:00+05:30`))
    : 'A fresh challenge every day';

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <button
          className="brand"
          onClick={() => {
            setScene('welcome');
            setFeedback(undefined);
            setError('');
          }}
          aria-label="Synle home"
        >
          <span className="brand-symbol" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          synle<span className="brand-dot">.</span>
        </button>
        <nav aria-label="Game options">
          <button
            className="icon-button"
            onClick={() => setModal('help')}
            aria-label="How to play"
          >
            <CircleHelp size={21} />
          </button>
          <button
            className={`icon-button ${sound ? 'is-on' : ''}`}
            onClick={toggleSound}
            aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={21} /> : <VolumeX size={21} />}
          </button>
          <button
            className="icon-button"
            onClick={() => setModal('settings')}
            aria-label="Settings"
          >
            <Settings2 size={21} />
          </button>
        </nav>
      </header>
      <nav className="page-nav" aria-label="Main navigation">
        {[
          ['/', 'Home'],
          ['/play', 'Play'],
          ['/history', 'History'],
          ['/about', 'How to play'],
        ].map(([path, label]) => (
          <a
            key={path}
            href={path}
            aria-current={page === path ? 'page' : undefined}
            onClick={(e) => {
              if (
                e.button !== 0 ||
                e.metaKey ||
                e.ctrlKey ||
                e.shiftKey ||
                e.altKey
              )
                return;
              e.preventDefault();
              navigate(path);
              if (path === '/') setSceneState('welcome');
            }}
          >
            {label}
          </a>
        ))}
      </nav>
      <div className="account-nav">
        {identity?.user ? (
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}
          >
            Hi, {identity.user.name}
          </a>
        ) : (
          <a
            href="/login"
            onClick={(e) => {
              e.preventDefault();
              navigate('/login');
            }}
          >
            Sign in
          </a>
        )}
      </div>
      <main id="main-content" tabIndex={-1}>
        {page === '/login' && (
          <section className="account-page login-page">
            <p className="panel-label">Your Synle account</p>
            <h1 tabIndex={-1}>Welcome to your next discovery.</h1>
            <p className="page-lede">
              Sign in for the demo and your private score history.
            </p>
            {new URLSearchParams(location.search).get('auth') && (
              <p role="status" className="notice">
                {new URLSearchParams(location.search).get('auth') ===
                'cancelled'
                  ? 'Sign-in was cancelled. Your progress is kept.'
                  : 'Sign-in could not be completed. Please try again.'}
              </p>
            )}
            {identity?.user ? (
              <div className="account-card">
                <p>
                  You’re signed in as <strong>{identity.user.name}</strong>.
                </p>
                <button
                  className="button primary"
                  onClick={() => navigate('/history')}
                >
                  View score history
                </button>
                <button
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await api('auth/logout', {});
                      setIdentity((i) => (i ? { ...i, user: null } : i));
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : 'Could not sign out.',
                      );
                    }
                  }}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="account-card">
                <h2>A place for your good words.</h2>
                <p>
                  Keep daily scores together, continue across devices, and
                  explore the replayable demo.
                </p>
                <a
                  className={`button primary full ${!identity?.enabled ? 'is-disabled' : ''}`}
                  href={
                    identity?.enabled
                      ? '/api/auth/google?returnTo=%2Fhistory'
                      : undefined
                  }
                  aria-disabled={!identity?.enabled}
                >
                  Continue with Google
                </a>
                {!identity?.enabled && (
                  <p>
                    Sign-in is temporarily unavailable. Home and the daily game
                    remain open.
                  </p>
                )}
                <p className="small">
                  We request only your Google identity and display name. Your
                  daily account game takes priority when merging guest progress.
                </p>
              </div>
            )}
            <button className="text-button" onClick={() => void start('daily')}>
              Play today without signing in
            </button>
          </section>
        )}
        {page === '/history' && !identity?.user && (
          <section className="account-page">
            <h1 tabIndex={-1}>Score history</h1>
            <p>Your daily discoveries are private to your account.</p>
          </section>
        )}
        {page === '/history' && identity?.user && (
          <HistoryPage
            play={() => void start('daily')}
            expired={() => {
              setIdentity((i) => (i ? { ...i, user: null } : i));
              requireLogin('/history');
            }}
            signedOut={() => {
              setIdentity((i) => (i ? { ...i, user: null } : i));
              navigate('/');
              setSceneState('welcome');
            }}
          />
        )}
        {page === '/about' && (
          <section className="account-page">
            <p className="panel-label">A little wordplay</p>
            <h1 tabIndex={-1}>One word. Many meanings.</h1>
            <p className="page-lede">
              Find unexpected synonyms for three words each day.
            </p>
            <div className="account-card">
              <h2>Make your five tries count.</h2>
              <ol>
                <li>
                  Submit a word or established phrase sharing any meaning of the
                  prompt.
                </li>
                <li>
                  Each word allows five attempts. Your best three accepted
                  answers count.
                </li>
                <li>
                  Familiar answers earn 50, uncommon 75, and rare 100 points.
                </li>
              </ol>
              <p>
                British and American spelling variants share one answer.
                Different synonyms count separately. Clear typos are corrected;
                duplicates don’t use an attempt. Opposites, loose associations
                and offensive terms don’t qualify.
              </p>
              <p>
                End a round early to keep earned points and explore its
                meanings. Report missing answers for future review; published
                scores stay fixed.
              </p>
              <button
                className="button primary"
                onClick={() => void start('daily')}
              >
                Play today
              </button>
            </div>
            <h2>Save your discoveries</h2>
            <p>
              Guest progress stays with this browser. Google sign-in connects
              daily progress and private history across devices. Existing
              account games take priority when merging. The demo is replayable
              and never counts in history.
            </p>
            <h2>Accessible wordplay</h2>
            <p>
              Keyboard navigation, visible focus, labelled controls,
              reduced-motion support, optional sounds, and light or dark
              appearance are built in. Scores and feedback use words as well as
              colour. We target WCAG 2.2 AA and test with axe, Lighthouse and
              manual checks; automated checks alone cannot establish full
              conformance.
            </p>
            <h2>Words and sources</h2>
            <p>
              Synle uses a reviewed answer bank derived from{' '}
              <a href="https://wordnet.princeton.edu/">Princeton WordNet</a> and
              editorial selections. Usage estimates come from{' '}
              <a href="https://github.com/rspeer/wordfreq">wordfreq</a> (CC
              BY-SA 4.0 data). Phrase rarity is reviewed as a whole. Fonts are
              Lexend and Source Sans 3 under the SIL Open Font License. Coverage
              is finite and regional expressions are still being expanded.
            </p>
          </section>
        )}
        {![
          '/',
          '/play',
          '/demo',
          '/results',
          '/history',
          '/about',
          '/login',
        ].includes(page) && (
          <section className="account-page">
            <h1>That page wandered off.</h1>
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                setScene('welcome');
              }}
            >
              Return home
            </a>
          </section>
        )}
        {storageWarning && (
          <p className="notice warning">
            Browser storage is unavailable. Keep this tab open to preserve your
            progress.
          </p>
        )}
        {error && (
          <div className="notice error" role="alert">
            <p>{error}</p>
            {game && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() => void start(mode)}
              >
                Reload saved progress
              </button>
            )}
            {(!meta || !canRestore) && (
              <button className="text-button" onClick={() => void initialise()}>
                Retry connection
              </button>
            )}
          </div>
        )}
        {page === '/' && scene === 'welcome' && (
          <section className="welcome">
            <div className="edition">
              <span className="live-dot" />
              The daily synonym game
              <span className="edition-date">{dateText}</span>
            </div>
            <div className="welcome-heading">
              <span className="little-spark s-one" aria-hidden="true">
                ✳
              </span>
              <h1>
                A little less
                <br />
                <span>obvious.</span>
              </h1>
              <span className="little-spark s-two" aria-hidden="true">
                ✳
              </span>
            </div>
            <p className="welcome-description">
              One word. Many meanings.
              <br />
              Find the synonyms nobody else thinks of.
            </p>
            <div
              className="example-strip"
              aria-label="Example: happy can mean joyful, elated, or over the moon"
            >
              <span className="example-prompt">happy</span>
              <ArrowRight size={19} aria-hidden="true" />
              <span className="example-answer">joyful</span>
              <span className="example-answer special">
                over the moon
                <Sparkles size={13} />
              </span>
            </div>
            <div className="play-panel">
              <div className="play-panel-top">
                <div>
                  <span className="panel-label">
                    {meta?.available
                      ? `Daily challenge #${meta.number}`
                      : 'Daily challenge'}
                  </span>
                  <h2>
                    {loading
                      ? 'Getting today’s words…'
                      : meta?.available
                        ? 'Your next good word awaits.'
                        : 'No challenge scheduled today.'}
                  </h2>
                </div>
                <span className="daily-icon" aria-hidden="true">
                  <Sparkles size={23} />
                </span>
              </div>
              <div className="rules-mini">
                <div>
                  <strong>3</strong>
                  <span>words to explore</span>
                </div>
                <div>
                  <strong>5</strong>
                  <span>tries per word</span>
                </div>
                <div>
                  <strong>3</strong>
                  <span>best answers count</span>
                </div>
              </div>
              <button
                className="button primary full"
                disabled={busy || loading || !meta?.available}
                onClick={() => void start('daily')}
              >
                {busy || loading ? (
                  <LoaderCircle className="spin" size={19} />
                ) : (
                  <>
                    {game?.mode === 'daily'
                      ? game.complete
                        ? 'View today’s results'
                        : 'Continue playing'
                      : 'Play today'}
                    <ArrowRight size={19} />
                  </>
                )}
              </button>
              <p className="panel-note">
                No timer. Take your time. Find a better word.
              </p>
            </div>
            <button
              className="demo-link"
              disabled={busy || loading}
              onClick={() => void start('demo')}
            >
              Just exploring? Try the demo <ArrowRight size={15} />
            </button>
            <div className="rarity-key">
              <span>
                <i className="key-dot familiar" />
                Familiar <b>50</b>
              </span>
              <span>
                <i className="key-dot uncommon" />
                Uncommon <b>75</b>
              </span>
              <span>
                <Sparkles size={13} className="rare-icon" />
                Rare <b>100</b>
              </span>
            </div>
          </section>
        )}

        {['/play', '/demo', '/results'].includes(page) &&
          (mode !== 'demo' || !!identity?.user) &&
          scene === 'game' &&
          game &&
          round && (
            <section className="game-screen">
              <div className="game-meta">
                <span>
                  {mode === 'demo'
                    ? 'Demo · play freely'
                    : `Daily #${game.number}`}
                </span>
                <span>Round {selected + 1} of 3</span>
                <span className="total-mini">
                  {game.total}
                  <small> / 900</small>
                </span>
              </div>
              <div className="round-track" aria-label="Round progress">
                {[0, 1, 2].map((i) => (
                  <button
                    key={i}
                    disabled={!game.rounds[i] || busy}
                    onClick={() => {
                      setSelected(i);
                      setFeedback(undefined);
                      setAnswer('');
                    }}
                    aria-label={`Round ${i + 1}${game.rounds[i]?.ended ? ', completed' : ''}`}
                    aria-current={selected === i ? 'step' : undefined}
                    className={`${i === selected ? 'active' : ''} ${game.rounds[i]?.ended ? 'done' : ''}`}
                  >
                    <span>
                      {game.rounds[i]?.ended ? <Check size={13} /> : i + 1}
                    </span>
                  </button>
                ))}
              </div>
              <div className="prompt-block">
                <p className="prompt-label">
                  {round.ended ? 'Word explored' : 'Your word is'}
                </p>
                <h1 key={round.word}>
                  {round.word}
                  <span className="prompt-spark" aria-hidden="true">
                    ✳
                  </span>
                </h1>
                <p>
                  {round.ended
                    ? 'A few good words go a long way.'
                    : 'Find a synonym. Any meaning counts.'}
                </p>
              </div>
              {!round.ended ? (
                <>
                  <form onSubmit={check} className="answer-form">
                    <label htmlFor="answer">Your answer</label>
                    <div className={`input-row ${busy ? 'checking' : ''}`}>
                      <input
                        id="answer"
                        ref={input}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="A word or phrase…"
                        maxLength={80}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="send"
                        disabled={busy}
                        required
                        aria-describedby="answer-help attempt-help"
                      />
                      <button
                        className="button primary"
                        disabled={busy || !answer.trim()}
                        type="submit"
                      >
                        {busy ? (
                          <LoaderCircle size={19} className="spin" />
                        ) : (
                          <>
                            Check <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                    </div>
                    <p className="small" id="answer-help">
                      Up to 80 characters. Words and established phrases are
                      welcome.
                    </p>
                  </form>
                  <div className="attempt-meter" id="attempt-help">
                    <span className="attempt-dots" aria-hidden="true">
                      {Array.from({ length: 5 }, (_, i) => (
                        <i
                          key={i}
                          className={i < round.attempts.length ? 'used' : ''}
                        />
                      ))}
                    </span>
                    <span>
                      <strong>{round.remaining}</strong>{' '}
                      {round.remaining === 1 ? 'attempt' : 'attempts'} remaining
                    </span>
                  </div>
                </>
              ) : (
                <div className="round-complete-banner">
                  <span className="check-circle">
                    <Check size={17} />
                  </span>
                  <div>
                    <strong>Round complete</strong>
                    <span>
                      {round.discoveries}{' '}
                      {round.discoveries === 1 ? 'meaning' : 'meanings'}{' '}
                      discovered · {round.attempts.length} of 5 attempts used
                    </span>
                  </div>
                  <strong className="banner-score">
                    {round.score}
                    <small> / 300</small>
                  </strong>
                </div>
              )}
              <div
                className={`feedback ${feedback?.kind || ''}`}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {feedback && (
                  <>
                    <span>
                      {feedback.kind === 'accepted' ? (
                        <Check size={18} />
                      ) : feedback.kind === 'incorrect' ? (
                        <X size={18} />
                      ) : (
                        <CircleHelp size={18} />
                      )}
                    </span>
                    <div>
                      <p>{feedback.message}</p>
                      {feedback.kind === 'accepted' &&
                        (feedback.increase ?? 0) > 0 && (
                          <small>
                            Best-three total increased by {feedback.increase}.
                          </small>
                        )}
                      {feedback.suggestions && (
                        <div className="suggestions">
                          {feedback.suggestions.map((s) => (
                            <button
                              key={s}
                              onClick={() => void check(undefined, s)}
                              disabled={busy}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="section-title">
                <div>
                  <h2>Your best three</h2>
                  <p>Only these answers count towards your score.</p>
                </div>
                <strong>
                  {round.score}
                  <small> / 300</small>
                </strong>
              </div>
              <div className="best-list">
                {Array.from({ length: 3 }, (_, i) =>
                  round.best[i] ? (
                    <AnswerRow
                      key={round.best[i].answerId}
                      attempt={round.best[i]}
                      rank={i + 1}
                    />
                  ) : (
                    <div key={`empty-${i}`} className="answer-slot empty">
                      <span className="rank">{i + 1}</span>
                      <span>
                        {round.ended
                          ? 'No scoring answer'
                          : i === 0
                            ? 'Your first discovery goes here'
                            : 'Another possibility awaits'}
                      </span>
                      <span className="empty-score">—</span>
                    </div>
                  ),
                )}
              </div>
              {round.attempts.length > 0 && (
                <details className="attempt-history" open={round.ended}>
                  <summary>
                    All attempts <span>{round.attempts.length}/5</span>
                    <ChevronDown size={16} />
                  </summary>
                  <ol>
                    {round.attempts.map((a, i) => (
                      <li key={i}>
                        <span className="history-number">{i + 1}</span>
                        <div>
                          <strong>{a.text}</strong>
                          {a.corrected && (
                            <small>Corrected from “{a.input}”</small>
                          )}
                          {!a.accepted && <small>Incorrect</small>}
                        </div>
                        {a.accepted ? (
                          <span className="history-points">{a.points}</span>
                        ) : (
                          <button
                            className="report-button"
                            onClick={() => void report(i)}
                            disabled={reported.has(`${selected}:${i}`)}
                            aria-label={`Report ${a.text} as a valid answer`}
                          >
                            <Flag size={13} />
                            {reported.has(`${selected}:${i}`)
                              ? 'Reported'
                              : 'Report'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {reportMessage && (
                <p className="report-message" role="status">
                  {reportMessage}
                </p>
              )}
              {round.ended && (
                <>
                  <details className="meaning-reveal">
                    <summary>
                      <Sparkles size={17} />
                      Explore the meanings
                      <ChevronDown size={17} />
                    </summary>
                    {round.reveal?.map((m) => (
                      <div className="meaning-group" key={m.meaning}>
                        <h3>{m.meaning}</h3>
                        <div>
                          {m.examples.map((a) => (
                            <span key={a.text}>
                              {a.text}
                              <small>{a.points}</small>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </details>
                  <button
                    className="button primary full next-button"
                    onClick={advance}
                  >
                    {selected === 2 ? 'See your results' : 'Next word'}
                    <ArrowRight size={18} />
                  </button>
                </>
              )}
              {!round.ended && (
                <button
                  className="end-round text-button"
                  onClick={() => setModal('end')}
                  disabled={busy}
                >
                  End this round <ChevronRight size={14} />
                </button>
              )}
            </section>
          )}

        {['/play', '/demo', '/results'].includes(page) &&
          (mode !== 'demo' || !!identity?.user) &&
          scene === 'results' &&
          game && (
            <section className="results-screen">
              <div className="edition">
                <span className="live-dot" />
                {mode === 'demo'
                  ? 'Demo complete'
                  : `Daily challenge #${game.number}`}
              </div>
              <div className="result-emblem" aria-hidden="true">
                <Sparkles size={31} />
              </div>
              <h1 ref={heading} tabIndex={-1}>
                {game.total >= 600
                  ? 'Quite the wordsmith.'
                  : game.total >= 300
                    ? 'Good words. Well found.'
                    : 'Every word is a discovery.'}
              </h1>
              <p className="result-description">
                Three words. A few unexpected possibilities.
              </p>
              <div className="big-score">
                {game.total}
                <span>/ 900</span>
              </div>
              <div className="result-rounds">
                {game.rounds.map((r, i) => (
                  <button
                    key={r.word}
                    onClick={() => {
                      setSelected(i);
                      setScene('game');
                      setFeedback(undefined);
                    }}
                  >
                    <span className="round-number">{i + 1}</span>
                    <span className="result-word">
                      {r.word}
                      <span className="result-squares">
                        {Array.from({ length: 3 }, (_, j) => (
                          <i key={j} className={r.best[j]?.tier || 'none'} />
                        ))}
                      </span>
                    </span>
                    <strong>
                      {r.score}
                      <small> / 300</small>
                    </strong>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
              {game.rounds
                .flatMap((r) => r.best)
                .sort((a, b) => b.points - a.points)[0] && (
                <div className="best-discovery">
                  <Sparkles size={18} />
                  <span>
                    Your best discovery
                    <strong>
                      {
                        game.rounds
                          .flatMap((r) => r.best)
                          .sort((a, b) => b.points - a.points)[0].text
                      }
                    </strong>
                  </span>
                  <span>
                    {
                      game.rounds
                        .flatMap((r) => r.best)
                        .sort((a, b) => b.points - a.points)[0].points
                    }{' '}
                    pts
                  </span>
                </div>
              )}
              <button
                className="button primary full"
                onClick={() => void share()}
              >
                <Copy size={18} />
                {copied ? 'Copied to clipboard' : 'Copy your results'}
              </button>
              {mode === 'demo' ? (
                <div className="demo-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void start('demo', true)}
                  >
                    <RotateCcw size={16} />
                    Play demo again
                  </button>
                  <button
                    className="text-button"
                    disabled={busy || !meta?.available}
                    onClick={() => void start('daily')}
                  >
                    Play today’s challenge
                    <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="next-challenge">
                  <p>A fresh set of words in</p>
                  <Countdown target={game.nextReset} />
                  <small>Resets at midnight IST</small>
                </div>
              )}
            </section>
          )}
      </main>
      <footer className="site-footer">
        <span>One word. Many meanings.</span>
        <button
          onClick={() => void start(mode === 'daily' ? 'demo' : 'daily')}
          disabled={busy || loading || (mode === 'demo' && !meta?.available)}
        >
          {mode === 'daily' ? 'Try the demo' : 'Daily challenge'}
          <ArrowRight size={13} />
        </button>
        <a
          href="/about"
          onClick={(e) => {
            e.preventDefault();
            navigate('/about');
          }}
        >
          About Synle
        </a>
      </footer>

      {modal === 'login' && (
        <Modal
          title={
            loginTarget === '/demo'
              ? 'Sign in to explore the demo'
              : 'Sign in to see your history'
          }
          close={dismissLogin}
        >
          <p>
            {loginTarget === '/demo'
              ? 'A little extra wordplay, ready whenever you are.'
              : 'Keep your daily discoveries together across devices.'}
          </p>
          <a
            className={`button primary full ${!identity?.enabled ? 'is-disabled' : ''}`}
            href={
              identity?.enabled
                ? `/api/auth/google?returnTo=${encodeURIComponent(loginTarget)}`
                : undefined
            }
            aria-disabled={!identity?.enabled}
          >
            Continue with Google
          </a>
          {!identity?.enabled && (
            <p className="small">
              Sign-in is temporarily unavailable. You can still play the daily
              game.
            </p>
          )}
          <p className="small">
            Home and the daily challenge are open without an account. Signing in
            won’t reset your daily attempts.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={dismissLogin}>
              Maybe later
            </button>
            <a
              className="text-button"
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                setModal(null);
                navigate('/login');
              }}
            >
              Go to sign-in page
            </a>
          </div>
        </Modal>
      )}
      {modal === 'help' && (
        <Modal title="A little wordplay" close={() => setModal(null)}>
          <p>
            Find words or established phrases that share{' '}
            <strong>any meaning</strong> of the prompt. Synonyms count;
            opposites and loose associations don’t.
          </p>
          <div className="help-example">
            <span>happy</span>
            <ArrowRight size={17} />
            <strong>joyful</strong>
          </div>
          <ol className="help-rules">
            <li>
              <strong>Three words each day.</strong> Everyone gets the same
              challenge.
            </li>
            <li>
              <strong>Five attempts per word.</strong> Your best three valid
              answers count.
            </li>
            <li>
              <strong>Think less obvious.</strong> Familiar answers earn 50,
              uncommon 75, and rare 100.
            </li>
          </ol>
          <p>
            British and American spellings count, alongside reviewed regional
            expressions and slang. Offensive terms don’t qualify. Different
            synonyms count separately; variations of the same expression don’t.
          </p>
          <p>
            Clear typos are corrected. Duplicates don’t use an attempt. You can
            report a missing answer for future review.
          </p>
          <button
            className="button primary full"
            onClick={() => setModal(null)}
          >
            Got it
          </button>
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal title="Make yourself at home" close={() => setModal(null)}>
          <fieldset className="theme-picker">
            <legend>Appearance</legend>
            <p>Choose your light. Keep your discoveries.</p>
            <div className="theme-options">
              {(
                [
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'Device', Icon: Monitor },
                ] as const
              ).map(({ value, label, Icon }) => (
                <label
                  key={value}
                  className={theme === value ? 'selected' : ''}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <Icon size={19} />
                  <span>{label}</span>
                  {theme === value && (
                    <Check size={14} className="theme-check" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="settings-row">
            <div>
              <strong>Game sounds</strong>
              <p>Small notes for good discoveries.</p>
            </div>
            <button
              className={`toggle ${sound ? 'on' : ''}`}
              role="switch"
              aria-checked={sound}
              aria-label="Game sounds"
              onClick={toggleSound}
            >
              <span />
            </button>
          </div>
          <h3 className="sound-title">Preview the sounds</h3>
          <p className="small">Previewing enables audio for the sample only.</p>
          <div className="sound-preview">
            {(
              [
                'familiar',
                'uncommon',
                'rare',
                'incorrect',
                'round',
                'complete',
              ] as Sound[]
            ).map((s) => (
              <button
                className="button secondary"
                key={s}
                onClick={() => {
                  unlockSound();
                  setTimeout(() => playSound(s), 80);
                }}
              >
                {s === 'round'
                  ? 'Round end'
                  : s === 'complete'
                    ? 'Game end'
                    : s[0].toUpperCase() + s.slice(1)}
                <Volume2 size={14} />
              </button>
            ))}
          </div>
          <div className="settings-note">
            <strong>Daily reset</strong>
            <p>
              Midnight in India (IST, UTC+5:30). Guest progress is saved for
              this browser. Sign in through History to continue across devices.
            </p>
          </div>
        </Modal>
      )}
      {modal === 'end' && (
        <Modal title="Finish this word?" close={() => setModal(null)}>
          <p>
            You have <strong>{round?.remaining} attempts left</strong>. Ending
            now keeps the points you’ve earned and reveals the answers. You
            can’t submit more answers for this round.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              Keep exploring
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void finishRound()}
            >
              {busy ? 'Finishing…' : 'End round'}
            </button>
          </div>
        </Modal>
      )}
      {modal === 'sources' && (
        <Modal title="A word about Synle" close={() => setModal(null)}>
          <p>
            Synle is a daily game about finding unexpected synonyms across a
            word’s many meanings.
          </p>
          <p>
            Answer sets combine WordNet candidates and editorial selections.
            Rarity uses word-usage estimates where available and editorial
            ratings for expressions. Coverage is still growing; reports help us
            improve future challenges.
          </p>
          <p>
            Dictionary data:{' '}
            <a
              href="https://wordnet.princeton.edu/"
              target="_blank"
              rel="noreferrer"
            >
              Princeton WordNet
            </a>
            . Frequency evidence:{' '}
            <a
              href="https://github.com/rspeer/wordfreq"
              target="_blank"
              rel="noreferrer"
            >
              wordfreq
            </a>{' '}
            (data under CC BY-SA 4.0). Fonts: Lexend and Source Sans 3 (SIL Open
            Font License).
          </p>
          <p className="small">
            Daily answers and scores stay fixed once published. No account is
            needed. The demo is separate from your daily game.
          </p>
        </Modal>
      )}
    </div>
  );
}

function AnswerRow({
  attempt,
  rank,
}: {
  attempt: ScoredAttempt;
  rank: number;
}) {
  return (
    <div className={`answer-slot filled ${attempt.tier}`}>
      <span className="rank">{rank}</span>
      <div className="answer-main">
        <div>
          <strong>{attempt.text}</strong>
          <Badge tier={attempt.tier!} />
        </div>
        <span>{attempt.meaning}</span>
      </div>
      <strong className="answer-points">
        {attempt.points}
        <small>pts</small>
      </strong>
    </div>
  );
}
