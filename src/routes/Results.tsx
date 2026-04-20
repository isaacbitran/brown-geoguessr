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

      <div className="border-t border-rule w-full max-w-md" />

      <ul className="w-full max-w-md">
        {results.map((r: RoundResult, i: number) => (
          <li
            key={r.location.id}
            className="flex justify-between border-b border-rule py-2 font-ui text-sm"
          >
            <span>Round {i + 1}</span>
            <span className="tabular">
              {Math.round(r.distanceM).toLocaleString()} m
            </span>
          </li>
        ))}
      </ul>

      <div className="w-full max-w-md flex flex-col gap-2">
        <p className="smallcaps text-warmgray text-xs text-center">
          Today's Leaderboard
        </p>
        {board === null && !boardError && (
          <p className="text-warmgray/60 font-ui text-xs text-center py-4">
            Loading…
          </p>
        )}
        {boardError && (
          <p className="text-warmgray/60 font-ui text-xs text-center py-4">
            Leaderboard unavailable.
          </p>
        )}
        {board !== null && board.length === 0 && (
          <p className="text-warmgray/60 font-ui text-xs text-center py-4">
            No scores posted yet today.
          </p>
        )}
        {board !== null && board.length > 0 && (
          <ol className="w-full">
            {board.map((row, i) => {
              const isMe =
                username != null &&
                row.username === username &&
                Math.round(row.total_m) === Math.round(total);
              return (
                <li
                  key={`${row.username}-${row.created_at}`}
                  className={`flex justify-between border-b border-rule py-2 font-ui text-sm ${
                    isMe ? 'text-brick font-semibold' : ''
                  }`}
                >
                  <span className="flex gap-3">
                    <span className="tabular text-warmgray w-6">{i + 1}.</span>
                    <span>{row.username}</span>
                  </span>
                  <span className="tabular">
                    {Math.round(row.total_m).toLocaleString()} m
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

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
