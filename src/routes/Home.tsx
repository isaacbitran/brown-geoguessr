import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getStreak, getUsername, hasPlayedToday } from '../lib/storage';
import { fetchPlayerStats, fetchTotalPlayers } from '../lib/supabase';
import UsernameModal from '../components/UsernameModal';

function formatLongDate(dateStr: string): string {
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
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [myWins, setMyWins] = useState(0);
  const [myTop10, setMyTop10] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchTotalPlayers()
      .then((n) => {
        if (!cancelled) setTotalPlayers(n);
      })
      .catch(() => {});
    fetchPlayerStats(today)
      .then((s) => {
        if (cancelled) return;
        if (username) {
          const me = s.get(username);
          setMyWins(me?.wins ?? 0);
          setMyTop10(me?.top10 ?? 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [username, today]);

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
        <p className="text-warmgray font-body text-lg">
          {formatLongDate(today)}
        </p>
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

      {(myWins > 0 || myTop10 > 0) && (
        <div className="flex flex-col items-center gap-1">
          {myWins > 0 && (
            <p className="text-warmgray font-ui text-sm">
              🥇 {myWins} {myWins === 1 ? 'win' : 'wins'}
            </p>
          )}
          {myTop10 > 0 && (
            <p className="text-warmgray font-ui text-sm">
              ⭐ {myTop10} top-10 {myTop10 === 1 ? 'finish' : 'finishes'}
            </p>
          )}
        </div>
      )}

      {username && (
        <p className="text-warmgray/60 font-ui text-xs">
          Playing as <span className="text-ink">{username}</span>
        </p>
      )}

      <div className="border-t border-rule w-full max-w-xs" />

      <div className="flex flex-col items-center gap-2">
        {totalPlayers !== null && totalPlayers > 0 && (
          <p className="font-serif italic text-warmgray text-sm">
            <span className="tabular text-ink">
              {totalPlayers.toLocaleString()}
            </span>{' '}
            {totalPlayers === 1 ? 'player' : 'players'}
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
