import type { RoundResult } from '../types';

const KEY_USERNAME = 'bg_username';
const KEY_LAST_PLAYED = 'bg_last_played_date';
const KEY_LAST_RESULT = 'bg_last_result';
const KEY_STREAK = 'bg_streak';

export function getUsername(): string | null {
  return localStorage.getItem(KEY_USERNAME);
}

export function setUsername(name: string): void {
  localStorage.setItem(KEY_USERNAME, name.trim().slice(0, 20));
}

export function getLastPlayedDate(): string | null {
  return localStorage.getItem(KEY_LAST_PLAYED);
}

export function hasPlayedToday(todayStr: string): boolean {
  return getLastPlayedDate() === todayStr;
}

export function getLastResult(): RoundResult[] | null {
  const raw = localStorage.getItem(KEY_LAST_RESULT);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getStreak(): number {
  return parseInt(localStorage.getItem(KEY_STREAK) ?? '0', 10) || 0;
}

function yesterdayStr(todayStr: string): string {
  const d = new Date(todayStr + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function saveDailyResult(
  todayStr: string,
  results: RoundResult[]
): number {
  const lastPlayed = getLastPlayedDate();
  let streak = getStreak();

  if (lastPlayed === yesterdayStr(todayStr)) {
    streak += 1;
  } else if (lastPlayed !== todayStr) {
    streak = 1;
  }

  localStorage.setItem(KEY_LAST_PLAYED, todayStr);
  localStorage.setItem(KEY_LAST_RESULT, JSON.stringify(results));
  localStorage.setItem(KEY_STREAK, String(streak));

  return streak;
}
