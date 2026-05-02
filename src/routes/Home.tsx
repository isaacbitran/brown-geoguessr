import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getStreak, getUsername, hasPlayedToday } from '../lib/storage';
import {
  fetchPlayerStats,
  fetchTopRecords,
  fetchTopStreaks,
  fetchTotalPlayers,
  fetchYesterdayChampions,
  type ChampionRecord,
  type StreakRecord,
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

interface RankedRow {
  primary: string; // displayed name
  secondary: string; // displayed metric (e.g. "1 m", "5", "3 days")
  caption?: string; // small caption (e.g. date)
}

interface LeftWidgetProps {
  title: string;
  rows: RankedRow[];
}

function LeftWidget({ title, rows }: LeftWidgetProps) {
  return (
    <aside className="flex flex-col items-center gap-3 w-full">
      <div className="h-6 flex items-center justify-center">
        <p className="font-serif smallcaps text-brick text-sm font-semibold underline decoration-2 underline-offset-4 text-center">
          {title}
        </p>
      </div>
      <ol className="w-full flex flex-col gap-2">
        {rows.map((r, j) => {
          const isFirst = j === 0;
          return (
            <li
              key={`${r.primary}-${j}`}
              className="grid grid-cols-[1.1rem_1fr_auto] items-baseline gap-2"
            >
              <span
                className={`font-serif tabular text-right ${
                  isFirst
                    ? 'text-brick text-sm font-semibold'
                    : 'text-warmgray/70 text-[0.65rem]'
                }`}
              >
                {j + 1}
              </span>
              <span
                className={`font-body italic text-[0.7rem] truncate ${
                  isFirst ? 'text-ink font-semibold' : 'text-ink'
                }`}
              >
                {r.primary}
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span
                  className={`font-ui tabular text-[0.65rem] ${
                    isFirst ? 'text-brick font-semibold' : 'text-ink/85'
                  }`}
                >
                  {r.secondary}
                </span>
                {r.caption && (
                  <span className="font-body italic text-warmgray/70 text-[0.55rem] mt-0.5">
                    {r.caption}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

interface RightWidgetProps {
  title: string;
  name: string;
  score: number;
  date: string;
  rank: 1 | 2 | 3;
}

function RightWidget({ title, name, score, date, rank }: RightWidgetProps) {
  // Uniform sizing across ranks → equal widget heights → even spacing in
  // the falling stack. Hierarchy comes from medal art + color, not size.
  const tier = {
    1: { color: 'text-gold', medalSrc: '/medal-gold.svg' },
    2: { color: 'text-warmgray', medalSrc: '/medal-silver.svg' },
    3: { color: 'text-[#6F4E37]', medalSrc: '/medal-bronze.svg' },
  }[rank];
  return (
    <aside className="flex flex-col items-center w-full gap-2">
      <div className="h-6 flex items-center justify-center gap-1.5">
        <img
          src={tier.medalSrc}
          alt=""
          aria-hidden
          className="w-4 h-4 object-contain select-none flex-shrink-0"
        />
        <p
          className={`font-serif smallcaps text-sm font-semibold underline decoration-2 underline-offset-4 text-center ${tier.color}`}
        >
          {title}
        </p>
        <img
          src={tier.medalSrc}
          alt=""
          aria-hidden
          className="w-4 h-4 object-contain select-none flex-shrink-0"
        />
      </div>
      <p
        className={`font-serif italic text-3xl font-semibold tracking-tight truncate w-full text-center px-2 ${tier.color}`}
      >
        {name}
      </p>
      <p className="font-body italic text-warmgray text-xs">
        <span className="tabular text-ink not-italic">
          {Math.round(score).toLocaleString()}
        </span>
        <span className="text-warmgray/70 ml-1 not-italic">m</span>
        <span className="text-warmgray/50 mx-2 not-italic">·</span>
        {formatMonthDay(date)}
      </p>
    </aside>
  );
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
  const [podium, setPodium] = useState<ChampionRecord[]>([]);
  const [topRecords, setTopRecords] = useState<WorldRecord[]>([]);
  const [topWins, setTopWins] = useState<
    Array<{ username: string; wins: number }>
  >([]);
  const [topStreaks, setTopStreaks] = useState<StreakRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTotalPlayers()
      .then((n) => {
        if (!cancelled) setTotalPlayers(n);
      })
      .catch(() => {});
    fetchYesterdayChampions(yesterday, 3)
      .then((rows) => {
        if (!cancelled) setPodium(rows);
      })
      .catch(() => {});
    fetchTopRecords(5)
      .then((rs) => {
        if (!cancelled) setTopRecords(rs);
      })
      .catch(() => {});
    fetchTopStreaks(5)
      .then((rs) => {
        if (!cancelled) setTopStreaks(rs);
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
        const wins = Array.from(s.entries())
          .filter(([, st]) => st.wins > 0)
          .sort(
            (a, b) =>
              b[1].wins - a[1].wins ||
              b[1].top10 - a[1].top10 ||
              a[0].localeCompare(b[0])
          )
          .slice(0, 5)
          .map(([u, st]) => ({ username: u, wins: st.wins }));
        setTopWins(wins);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [username, today, yesterday]);

  // LEFT lane content — three rotating leaderboards (records → wins → streaks).
  const leftWidgets = useMemo<Array<{ title: string; rows: RankedRow[] }>>(() => {
    const out: Array<{ title: string; rows: RankedRow[] }> = [];
    if (topRecords.length > 0) {
      out.push({
        title: 'All-Time Records',
        rows: topRecords.map((r) => ({
          primary: r.username,
          secondary: `${Math.round(r.total_m).toLocaleString()} m`,
          caption: formatShortMonthDay(r.date),
        })),
      });
    }
    if (topWins.length > 0) {
      out.push({
        title: 'Most Wins',
        rows: topWins.map((w) => ({
          primary: w.username,
          secondary: `${w.wins} ${w.wins === 1 ? 'win' : 'wins'}`,
        })),
      });
    }
    if (topStreaks.length > 0) {
      out.push({
        title: 'Top Streaks',
        rows: topStreaks.map((s) => ({
          primary: s.username,
          secondary: `${s.streak} ${s.streak === 1 ? 'day' : 'days'}`,
        })),
      });
    }
    return out;
  }, [topRecords, topWins, topStreaks]);

  // RIGHT lane content — yesterday's podium (3rd → 2nd → 1st falling order).
  const rightWidgets = useMemo<
    Array<{ title: string; name: string; score: number; rank: 1 | 2 | 3 }>
  >(() => {
    const titles = [
      "Yesterday's Champion",
      "Yesterday's 2nd Place",
      "Yesterday's 3rd Place",
    ];
    return podium
      .slice(0, 3)
      .map((p, i) => ({
        title: titles[i],
        name: p.username,
        score: p.total_m,
        rank: (i + 1) as 1 | 2 | 3,
      }))
      .reverse(); // winner falls last for climactic order
  }, [podium]);

  // Stagger widgets across a 30s cycle (10s apart) so all 3 are visible at
  // different vertical positions at any given moment.
  const STAGGER_S = 10;

  return (
    <div className="relative min-h-full">
      {/* LEFT LANE — cycling leaderboards (records → wins → streaks) */}
      {leftWidgets.length > 0 && (
        <div className="hidden lg:block absolute left-10 xl:left-20 top-0 bottom-0 w-52 pointer-events-none overflow-hidden">
          {leftWidgets.map((w, i) => (
            <div
              key={w.title}
              className="fall-widget absolute top-0 left-0 right-0"
              style={{ animationDelay: `${-i * STAGGER_S}s` }}
            >
              <LeftWidget title={w.title} rows={w.rows} />
            </div>
          ))}
        </div>
      )}

      {/* RIGHT LANE — yesterday's podium (1st → 2nd → 3rd) */}
      {rightWidgets.length > 0 && (
        <div className="hidden lg:block absolute right-10 xl:right-20 top-0 bottom-0 w-52 pointer-events-none overflow-hidden">
          {rightWidgets.map((w, i) => (
            <div
              key={w.title}
              className="fall-widget absolute top-0 left-0 right-0"
              style={{ animationDelay: `${-i * STAGGER_S}s` }}
            >
              <RightWidget
                title={w.title}
                name={w.name}
                score={w.score}
                date={yesterday}
                rank={w.rank}
              />
            </div>
          ))}
        </div>
      )}

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
