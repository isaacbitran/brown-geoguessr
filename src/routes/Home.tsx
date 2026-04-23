import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getStreak, getUsername, hasPlayedToday } from '../lib/storage';
import {
  fetchPlayerStats,
  fetchTopRecords,
  fetchTotalPlayers,
  fetchYesterdayChampions,
  type ChampionRecord,
  type WorldRecord,
} from '../lib/supabase';
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

function formatMonthDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function formatShortMonthDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Home() {
  const today = todayDateStr();
  const yesterday = shiftDateStr(today, -1);
  const [username, setUsernameState] = useState(getUsername);
  const played = hasPlayedToday(today);
  const streak = getStreak();
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [myWins, setMyWins] = useState(0);
  const [myTop10, setMyTop10] = useState(0);
  const [champions, setChampions] = useState<ChampionRecord[] | null>(null);
  const [topRecords, setTopRecords] = useState<WorldRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTotalPlayers()
      .then((n) => {
        if (!cancelled) setTotalPlayers(n);
      })
      .catch(() => {});
    fetchYesterdayChampions(yesterday, 1)
      .then((rows) => {
        if (!cancelled) setChampions(rows);
      })
      .catch(() => {});
    fetchTopRecords(5)
      .then((rs) => {
        if (!cancelled) setTopRecords(rs);
      })
      .catch(() => {});
    if (username) {
      fetchPlayerStats(today)
        .then((s) => {
          if (cancelled) return;
          const me = s.get(username);
          setMyWins(me?.wins ?? 0);
          setMyTop10(me?.top10 ?? 0);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [username, today, yesterday]);

  return (
    <div className="relative min-h-full">
      {/* SIDEBARS — both widgets share a centered wrapper so their underlined
          headings align at the same Y regardless of internal heights. */}
      <div className="hidden lg:flex absolute top-1/2 -translate-y-1/2 left-10 right-10 xl:left-20 xl:right-20 justify-between items-start pointer-events-none">
        {/* LEFT — All-Time Records (top 5, deduped per player) */}
        {topRecords.length > 0 ? (
          <aside className="flex flex-col items-center gap-4 w-52">
            <p className="smallcaps text-brick text-sm font-semibold underline decoration-2 underline-offset-4">
              All-Time Records
            </p>
            <ol className="w-full flex flex-col gap-2.5">
              {topRecords.map((r, i) => {
                const isFirst = i === 0;
                return (
                  <li
                    key={`${r.username}-${r.date}`}
                    className="grid grid-cols-[1.25rem_1fr_auto] items-baseline gap-2"
                  >
                    <span
                      className={`font-serif tabular text-right ${
                        isFirst
                          ? 'text-brick text-base font-semibold'
                          : 'text-warmgray/70 text-xs'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`font-body italic text-xs truncate ${
                        isFirst ? 'text-ink font-semibold' : 'text-ink'
                      }`}
                    >
                      {r.username}
                    </span>
                    <span className="flex flex-col items-end leading-tight">
                      <span
                        className={`font-ui tabular text-[0.7rem] ${
                          isFirst ? 'text-brick font-semibold' : 'text-ink/85'
                        }`}
                      >
                        {Math.round(r.total_m).toLocaleString()}
                        <span className="text-warmgray/60 ml-0.5">m</span>
                      </span>
                      <span className="font-body italic text-warmgray/70 text-[0.6rem] mt-0.5">
                        {formatShortMonthDay(r.date)}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>
        ) : (
          <div />
        )}

        {/* RIGHT — Yesterday's Champion */}
        {champions && champions.length > 0 ? (
          <aside className="flex flex-col items-center gap-4 w-72">
            <p className="smallcaps text-gold text-sm font-semibold underline decoration-2 underline-offset-4">
              Yesterday's Champion
            </p>
            <p className="font-serif italic text-6xl text-gold font-semibold tracking-tight truncate w-full text-center px-2">
              {champions[0].username}
            </p>
            <p className="font-body italic text-warmgray text-base">
              <span className="tabular text-ink not-italic">
                {Math.round(champions[0].total_m).toLocaleString()}
              </span>
              <span className="text-warmgray/70 ml-1 not-italic">m</span>
              <span className="text-warmgray/50 mx-2 not-italic">·</span>
              {formatMonthDay(yesterday)}
            </p>
          </aside>
        ) : (
          <div />
        )}
      </div>

      {/* CENTER — original home page, untouched */}
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
    </div>
  );
}
