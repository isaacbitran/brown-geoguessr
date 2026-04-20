import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { todayDateStr } from '../lib/daily';
import { getLastResult, getStreak, getUsername, hasPlayedToday } from '../lib/storage';
import { fetchTodayLeaderboard, type LeaderboardRow } from '../lib/supabase';
import type { RoundResult } from '../types';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function timeUntilMidnight(): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const diff = tomorrow.getTime() - now.getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

export default function Results() {
  const navigate = useNavigate();
  const today = todayDateStr();
  const results = getLastResult();
  const username = getUsername();
  const streak = getStreak();
  const [countdown, setCountdown] = useState(timeUntilMidnight);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [boardError, setBoardError] = useState(false);
  const [tab, setTab] = useState<'leaderboard' | 'rounds'>('leaderboard');
  const watermarkRef = useRef<HTMLDivElement>(null);

  // Rounds tab uses JS parallax (short pages work better with scrollY * k).
  // Leaderboard uses CSS scroll-timeline (applied via the parallax-watermark class).
  useEffect(() => {
    const el = watermarkRef.current;
    if (!el) return;
    if (tab !== 'rounds') {
      el.style.transform = '';
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      if (!watermarkRef.current) return;
      watermarkRef.current.style.transform = `translate3d(0, ${window.scrollY * -0.02}px, 0)`;
    };
    update();
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [tab]);

  useEffect(() => {
    if (!hasPlayedToday(today)) {
      navigate('/');
      return;
    }
    const id = window.setInterval(() => setCountdown(timeUntilMidnight()), 60_000);
    return () => clearInterval(id);
  }, [today, navigate]);

  useEffect(() => {
    let cancelled = false;
    fetchTodayLeaderboard(today)
      .then((rows) => {
        if (!cancelled) setBoard(rows);
      })
      .catch(() => {
        if (!cancelled) setBoardError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const total = useMemo(
    () => (results ?? []).reduce((s, r) => s + r.distanceM, 0),
    [results]
  );

  if (!results) {
    return (
      <div className="min-h-full flex items-center justify-center p-8">
        <p className="text-warmgray">No results to show.</p>
      </div>
    );
  }

  return (
    <>
      {/* Watermark — leaderboard: CSS scroll-timeline. Rounds: JS scroll × 0.02 */}
      <div
        ref={watermarkRef}
        aria-hidden
        className={`${tab === 'leaderboard' ? 'parallax-watermark' : ''} fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden`}
        style={tab === 'rounds' ? { willChange: 'transform' } : undefined}
      >
        <img
          src="/brown-logo.png"
          alt=""
          className="w-[75vmin] max-w-none opacity-[0.12] select-none"
        />
      </div>

      <div className="relative z-10 min-h-full flex flex-col items-center justify-start gap-6 p-8 pt-10">
      {/* Masthead */}
      <div className="flex flex-col items-center gap-3 w-full max-w-md">
        <p className="smallcaps text-warmgray text-xs text-center">
          Brown GeoGuessr — {formatDate(today)} Edition
        </p>
        <div className="w-full h-px bg-rule" aria-hidden />
      </div>

      {/* Score */}
      <h1 className="font-serif text-6xl font-semibold tabular">
        {Math.round(total).toLocaleString()} m
      </h1>

      {/* Countdown to next edition — tucked between score and playing-as */}
      <p className="font-serif italic text-brick text-lg tabular -mt-2">
        Next edition in <span className="font-extrabold">{countdown}</span>
      </p>

      {/* Playing as + streak */}
      <div className="flex flex-col items-center gap-3">
        {username && (
          <div className="flex flex-col items-center gap-1">
            <p className="smallcaps text-warmgray text-xs">Playing as</p>
            <p className="font-serif text-xl text-ink">{username}</p>
          </div>
        )}
        {streak > 0 && (
          <p className="text-warmgray font-ui text-sm mt-1">
            🔥 {streak} day streak
          </p>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3 flex-wrap justify-center">
        <Link
          to="/play"
          state={{ started: true, freeplay: true }}
          className="bg-brick text-cream px-6 py-3 font-ui uppercase tracking-widest text-xs hover:bg-ink transition-colors"
        >
          Free Play
        </Link>
        <Link
          to="/"
          className="border border-ink px-6 py-3 font-ui uppercase tracking-widest text-xs hover:bg-ink hover:text-cream transition-colors"
        >
          Home
        </Link>
      </div>

      {/* Tabs + content */}
      <section className="w-full max-w-md flex flex-col gap-4">
        <div
          role="tablist"
          className="flex justify-center gap-8 border-b border-rule"
        >
          <button
            role="tab"
            aria-selected={tab === 'leaderboard'}
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`font-ui uppercase tracking-widest text-xs pb-2 -mb-px border-b-2 transition-colors ${
              tab === 'leaderboard'
                ? 'border-brick text-brick'
                : 'border-transparent text-warmgray hover:text-ink'
            }`}
          >
            Leaderboard
          </button>
          <button
            role="tab"
            aria-selected={tab === 'rounds'}
            type="button"
            onClick={() => setTab('rounds')}
            className={`font-ui uppercase tracking-widest text-xs pb-2 -mb-px border-b-2 transition-colors ${
              tab === 'rounds'
                ? 'border-brick text-brick'
                : 'border-transparent text-warmgray hover:text-ink'
            }`}
          >
            Rounds
          </button>
        </div>

        {tab === 'leaderboard' ? (
          <>
            {board === null && !boardError && (
              <p className="text-warmgray/60 font-serif italic text-sm text-center py-6">
                Loading…
              </p>
            )}
            {boardError && (
              <p className="text-warmgray/60 font-serif italic text-sm text-center py-6">
                Leaderboard unavailable.
              </p>
            )}
            {board !== null && board.length === 0 && (
              <p className="text-warmgray/60 font-serif italic text-sm text-center py-6">
                Awaiting challengers.
              </p>
            )}
            {board !== null && board.length > 0 && (
              <ol className="w-full">
                {board.map((row, i) => {
                  const isMe =
                    username != null &&
                    row.username === username &&
                    Math.round(row.total_m) === Math.round(total);
                  const rank = i + 1;
                  const isFirst = rank === 1;
                  const isTop3 = rank <= 3;
                  const rankColor = isFirst
                    ? 'text-brick'
                    : isTop3
                      ? 'text-[#A89B86]'
                      : 'text-[#C9BFAA]';
                  const rankSize = isFirst ? 'text-3xl' : 'text-lg';
                  return (
                    <li
                      key={`${row.username}-${row.created_at}`}
                      className={`grid grid-cols-[2.5rem_1fr_5.5rem] items-baseline gap-4 border-b border-[#E5DDC9] py-3.5 ${
                        isMe ? 'bg-brick px-3 -mx-3' : ''
                      }`}
                    >
                      <span
                        className={`font-serif tabular text-right font-semibold ${rankSize} ${
                          isMe ? 'text-cream' : rankColor
                        }`}
                      >
                        {rank}
                      </span>
                      <span
                        className={`font-body text-base truncate ${
                          isMe
                            ? 'text-cream font-semibold'
                            : `text-ink ${isFirst ? 'font-semibold' : ''}`
                        }`}
                      >
                        {row.username}
                      </span>
                      <span
                        className={`font-body tabular text-base text-right ${
                          isMe
                            ? 'text-cream font-semibold'
                            : isFirst
                              ? 'text-brick font-semibold'
                              : 'text-ink/85'
                        }`}
                      >
                        {Math.round(row.total_m).toLocaleString()}
                        <span
                          className={`ml-1 font-ui text-sm ${
                            isMe ? 'text-cream/70' : 'text-warmgray/60'
                          }`}
                        >
                          m
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        ) : (
          <ol className="w-full">
            {(() => {
              const bestIdx = results.reduce(
                (best, r, i) =>
                  r.distanceM < results[best].distanceM ? i : best,
                0
              );
              return results.map((r: RoundResult, i: number) => {
                const isBest = i === bestIdx;
                const rankColor = isBest ? 'text-brick' : 'text-[#C9BFAA]';
                const rankSize = isBest ? 'text-3xl' : 'text-lg';
                return (
                  <li
                    key={r.location.id}
                    className="grid grid-cols-[2.5rem_1fr_5.5rem] items-baseline gap-4 border-b border-[#E5DDC9] py-3.5"
                  >
                    <span
                      className={`font-serif tabular text-right font-semibold ${rankColor} ${rankSize}`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`font-body text-base flex items-baseline gap-2 text-ink ${
                        isBest ? 'font-semibold' : ''
                      }`}
                    >
                      <span>Round {i + 1}</span>
                      {isBest && (
                        <span className="smallcaps text-[0.65rem] text-brick font-ui">
                          best
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-body tabular text-base text-right ${
                        isBest ? 'text-brick font-semibold' : 'text-ink/85'
                      }`}
                    >
                      {Math.round(r.distanceM).toLocaleString()}
                      <span className="text-warmgray/60 ml-1 font-ui text-sm">
                        m
                      </span>
                    </span>
                  </li>
                );
              });
            })()}
          </ol>
        )}
      </section>

      {/* Footer mirror */}
      {tab === 'leaderboard' && board !== null && board.length > 0 && (
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <div className="w-full h-px bg-rule" aria-hidden />
          <p className="smallcaps text-warmgray text-xs text-center">
            Brown GeoGuessr · {board.length}{' '}
            {board.length === 1 ? 'player' : 'players'} today
          </p>
        </div>
      )}

      </div>
    </>
  );
}
