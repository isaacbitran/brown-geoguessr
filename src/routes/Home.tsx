import { useState } from 'react';
import { Link } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getUsername, getStreak, hasPlayedToday } from '../lib/storage';
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

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-serif text-5xl md:text-6xl font-semibold tracking-tight">
          Brown GeoGuessr
        </h1>
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
