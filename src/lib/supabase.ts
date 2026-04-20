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
  date: string,
  limit = 20
): Promise<LeaderboardRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('plays')
    .select('username, total_m, created_at')
    .eq('date', date)
    .order('total_m', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTotalPlays(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('plays')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}
