import { useEffect, useMemo, useState } from 'react';
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
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-1">
        <p className="smallcaps text-warmgray text-xs">
          Brown GeoGuessr — {formatDate(today)} Edition
        </p>
      </div>

      <h1 className="font-serif text-6xl font-semibold tabular">
        {Math.round(total).toLocaleString()} m
      </h1>

      <div className="flex flex-col items-center gap-1">
        {username && (
          <p className="text-warmgray font-ui text-sm">{username}</p>
        )}
        {streak > 0 && (
          <p className="text-warmgray font-ui text-sm">🔥 {streak} day streak</p>
        )}
      </div>

      <section className="w-full max-w-md flex flex-col gap-4">
        <div role="tablist" className="flex justify-center gap-8">
          <button
            role="tab"
            aria-selected={tab === 'leaderboard'}
            type="button"
            onClick={() => setTab('leaderboard')}
            className={`font-ui uppercase tracking-widest text-xs py-1 transition-colors ${
              tab === 'leaderboard'
                ? 'text-brick'
                : 'text-warmgray hover:text-ink'
            }`}
          >
            Leaderboard
          </button>
          <button
            role="tab"
            aria-selected={tab === 'rounds'}
            type="button"
            onClick={() => setTab('rounds')}
            className={`font-ui uppercase tracking-widest text-xs py-1 transition-colors ${
              tab === 'rounds' ? 'text-brick' : 'text-warmgray hover:text-ink'
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
                  return (
                    <li
                      key={`${row.username}-${row.created_at}`}
                      className={`relative grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-3 border-b border-rule/60 py-2.5 ${
                        isMe ? 'bg-brick/[0.04]' : ''
                      }`}
                    >
                      {isMe && (
                        <span
                          className="absolute -left-2 top-0 bottom-0 w-[2px] bg-brick"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`font-serif tabular text-right ${
                          isFirst
                            ? 'text-gold text-xl font-semibold'
                            : 'text-warmgray/80 text-base'
                        }`}
                      >
                        {rank}
                      </span>
                      <span
                        className={`font-ui text-sm truncate flex items-baseline gap-2 ${
                          isMe
                            ? 'text-brick font-semibold'
                            : isFirst
                              ? 'text-ink font-medium'
                              : 'text-ink'
                        }`}
                      >
                        <span className="truncate">{row.username}</span>
                        {isMe && (
                          <span className="smallcaps text-[0.65rem] text-brick/70">
                            you
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-ui tabular text-sm ${
                          isMe ? 'text-brick font-semibold' : 'text-ink/85'
                        }`}
                      >
                        {Math.round(row.total_m).toLocaleString()}
                        <span className="text-warmgray/60 ml-1">m</span>
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
                return (
                  <li
                    key={r.location.id}
                    className="grid grid-cols-[2.25rem_1fr_auto] items-baseline gap-3 border-b border-rule/60 py-2.5"
                  >
                    <span
                      className={`font-serif tabular text-right ${
                        isBest
                          ? 'text-gold text-xl font-semibold'
                          : 'text-warmgray/80 text-base'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`font-ui text-sm flex items-baseline gap-2 ${
                        isBest ? 'text-ink font-medium' : 'text-ink'
                      }`}
                    >
                      <span>Round {i + 1}</span>
                      {isBest && (
                        <span className="smallcaps text-[0.65rem] text-gold">
                          best
                        </span>
                      )}
                    </span>
                    <span className="font-ui tabular text-sm text-ink/85">
                      {Math.round(r.distanceM).toLocaleString()}
                      <span className="text-warmgray/60 ml-1">m</span>
                    </span>
                  </li>
                );
              });
            })()}
          </ol>
        )}
      </section>

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

      <p className="text-warmgray/60 font-ui text-xs">
        Next edition in {countdown}
      </p>
    </div>
  );
}
