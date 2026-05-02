import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;

// Postgrest defaults to a 1000-row cap when no explicit limit is set, which
// silently truncated whole-table queries once the plays table passed 1000.
// Set a generous explicit ceiling for table-wide aggregations.
const MAX_ROWS = 50_000;

export interface LeaderboardRow {
  username: string;
  total_m: number;
  created_at: string;
}

export async function submitPlay(
  date: string,
  username: string,
  totalM: number
): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('plays')
    .insert({ date, username, total_m: Math.round(totalM) });
  if (error) throw error;
}

export async function fetchTodayLeaderboard(
  date: string
): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('plays')
    .select('username, total_m, created_at')
    .eq('date', date)
    .order('total_m', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTotalPlayers(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase
    .from('plays')
    .select('username')
    .limit(MAX_ROWS);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.username)).size;
}

export interface PlayerStats {
  wins: number;
  top10: number;
}

export interface ChampionRecord {
  username: string;
  total_m: number;
}

export interface StreakRecord {
  username: string;
  streak: number;
}

// Computes each player's CURRENT consecutive-day play streak ending at their
// most recent play, and returns the top N. Filtered to only "active" streaks
// (most recent play was today or yesterday).
export async function fetchTopStreaks(limit = 5): Promise<StreakRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('plays')
    .select('username, date')
    .limit(MAX_ROWS);
  if (error) throw error;

  const datesByUser = new Map<string, Set<string>>();
  for (const r of (data ?? []) as Array<{ username: string; date: string }>) {
    let set = datesByUser.get(r.username);
    if (!set) {
      set = new Set();
      datesByUser.set(r.username, set);
    }
    set.add(r.date);
  }

  const today = new Date();
  const yest = new Date(today);
  yest.setDate(today.getDate() - 1);
  const yestStr =
    yest.getFullYear() +
    '-' +
    String(yest.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(yest.getDate()).padStart(2, '0');

  const prevDay = (s: string): string => {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  };

  const result: StreakRecord[] = [];
  for (const [username, dates] of datesByUser) {
    const mostRecent = Array.from(dates).sort().pop();
    if (!mostRecent || mostRecent < yestStr) continue;
    let streak = 0;
    let cursor = mostRecent;
    while (dates.has(cursor)) {
      streak += 1;
      cursor = prevDay(cursor);
    }
    result.push({ username, streak });
  }

  return result
    .sort(
      (a, b) =>
        b.streak - a.streak || a.username.localeCompare(b.username)
    )
    .slice(0, limit);
}

export interface WorldRecord {
  username: string;
  total_m: number;
  date: string;
}

// All-time best scores across every play ever submitted. Deduped per user
// (their personal best only) so a single dominant player can't hog the list.
export async function fetchTopRecords(limit = 5): Promise<WorldRecord[]> {
  if (!supabase) return [];
  // Overshoot the limit to leave room for dedup, then trim.
  const { data, error } = await supabase
    .from('plays')
    .select('username, total_m, date')
    .order('total_m', { ascending: true })
    .limit(limit * 5);
  if (error) throw error;
  const seen = new Map<string, WorldRecord>();
  for (const r of (data ?? []) as WorldRecord[]) {
    if (!seen.has(r.username)) seen.set(r.username, r);
  }
  return Array.from(seen.values()).slice(0, limit);
}

// Returns yesterday's top finishers (deduped to best score per user, sorted
// best→worst). Caller can split into winner(s) + runners-up by checking
// which leading entries share the minimum total_m.
export async function fetchYesterdayChampions(
  yesterdayStr: string,
  limit = 3
): Promise<ChampionRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('plays')
    .select('username, total_m')
    .eq('date', yesterdayStr)
    .order('total_m', { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const bestPerUser = new Map<string, number>();
  for (const r of data as ChampionRecord[]) {
    const prev = bestPerUser.get(r.username);
    if (prev == null || r.total_m < prev) bestPerUser.set(r.username, r.total_m);
  }
  return Array.from(bestPerUser.entries())
    .map(([username, total_m]) => ({ username, total_m }))
    .sort((a, b) => a.total_m - b.total_m)
    .slice(0, limit);
}

// Aggregates historical wins + top-10 finishes per username, from completed
// past dates only (pass `excludeDate` = today so today's unfinished edition
// doesn't count toward anyone's record). Ties for 1st all count as wins.
// If a user plays multiple times on the same day, only their best score counts.
export async function fetchPlayerStats(
  excludeDate?: string
): Promise<Map<string, PlayerStats>> {
  if (!supabase) return new Map();
  let q = supabase
    .from('plays')
    .select('date, username, total_m')
    .limit(MAX_ROWS);
  if (excludeDate) q = q.neq('date', excludeDate);
  const { data, error } = await q;
  if (error) throw error;

  // date → (username → best total_m that day)
  const byDate = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as Array<{
    date: string;
    username: string;
    total_m: number;
  }>) {
    const users = byDate.get(row.date) ?? new Map<string, number>();
    const prev = users.get(row.username);
    if (prev == null || row.total_m < prev) users.set(row.username, row.total_m);
    byDate.set(row.date, users);
  }

  const stats = new Map<string, PlayerStats>();
  const bump = (u: string, key: keyof PlayerStats) => {
    const s = stats.get(u) ?? { wins: 0, top10: 0 };
    s[key] += 1;
    stats.set(u, s);
  };

  for (const users of byDate.values()) {
    const sorted = Array.from(users.entries())
      .map(([username, total_m]) => ({ username, total_m }))
      .sort((a, b) => a.total_m - b.total_m);
    if (sorted.length === 0) continue;
    const minM = sorted[0].total_m;
    for (const p of sorted) {
      if (p.total_m === minM) bump(p.username, 'wins');
      else break;
    }
    for (let i = 0; i < Math.min(10, sorted.length); i++) {
      bump(sorted[i].username, 'top10');
    }
  }
  return stats;
}
