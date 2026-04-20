import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getUsername, getStreak, hasPlayedToday } from '../lib/storage';
import { fetchTotalPlays } from '../lib/supabase';
import UsernameModal from '../components/UsernameModal';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function Home() {
  const today = todayDateStr();
  const [username, setUsernameState] = useState(getUsername);
  const played = hasPlayedToday(today);
  const streak = getStreak();
  const [totalPlays, setTotalPlays] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTotalPlays()
      .then((n) => {
        if (!cancelled) setTotalPlays(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/brown-logo.png"
          alt=""
          className="w-24 h-24 md:w-28 md:h-28 object-contain"
        />
        <h1 className="font-serif text-5xl md:text-6xl font-semibold tracking-tight">
          Brown GeoGuessr
        </h1>
        <p className="font-serif italic text-xl md:text-2xl text-ink/80">
          How well do you know College Hill?
        </p>
        <p className="text-warmgray font-body text-lg">{formatDate(today)}</p>
      </div>

      <div className="border-t border-rule w-full max-w-xs" />

      <Link
        to={played ? '/results' : '/play'}
        state={played ? undefined : { started: true }}
        className="bg-brick text-cream px-8 py-4 font-ui uppercase tracking-widest text-sm hover:bg-ink transition-colors"
      >
        {played ? "See Today's Results" : "Play Today's Edition"}
      </Link>

      {streak > 0 && (
        <p className="text-warmgray font-ui text-sm">
          🔥 {streak} day streak
        </p>
      )}

      {username && (
        <p className="text-warmgray/60 font-ui text-xs">
          Playing as <span className="text-ink">{username}</span>
        </p>
      )}

      <div className="border-t border-rule w-full max-w-xs" />

      <div className="flex flex-col items-center gap-2">
        {totalPlays !== null && totalPlays > 0 && (
          <p className="font-serif italic text-warmgray text-sm">
            <span className="tabular text-ink">{totalPlays.toLocaleString()}</span>{' '}
            {totalPlays === 1 ? 'play' : 'plays'} so far
          </p>
        )}
        <Link
          to="/how"
          className="text-warmgray text-xs font-ui uppercase tracking-widest hover:text-ink"
        >
          How to play
        </Link>
      </div>

      {!username && (
        <UsernameModal onDone={(name) => setUsernameState(name)} />
      )}
    </div>
  );
}
