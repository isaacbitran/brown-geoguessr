import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;

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
  const { data, error } = await supabase.from('plays').select('username');
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
  let q = supabase.from('plays').select('date, username, total_m');
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
