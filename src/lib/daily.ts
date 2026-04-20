import type { Difficulty, GameLocation } from '../types';

function seedFromDate(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = ((s >>> 0) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function todayDateStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function pickRandomLocations(all: GameLocation[]): GameLocation[] {
  const seed = (Math.random() * 2147483647) | 0;
  return pickWithSeed(all, seed);
}

export function pickDailyLocations(
  all: GameLocation[],
  dateStr?: string
): GameLocation[] {
  const date = dateStr ?? todayDateStr();
  const seed = seedFromDate(date);
  return pickWithSeed(all, seed);
}

function pickWithSeed(all: GameLocation[], seed: number): GameLocation[] {

  const byDiff = (d: Difficulty) => all.filter((l) => l.difficulty === d);
  const easy = seededShuffle(byDiff('easy'), seed);
  const medium = seededShuffle(byDiff('medium'), seed + 1);
  const hard = seededShuffle(byDiff('hard'), seed + 2);

  const pick = [
    ...easy.slice(0, 2),
    ...medium.slice(0, 2),
    ...hard.slice(0, 1),
  ];

  // Pad if a pool is too small — never crash.
  if (pick.length < 5) {
    const used = new Set(pick.map((l) => l.id));
    const remaining = seededShuffle(
      all.filter((l) => !used.has(l.id)),
      seed + 3
    );
    while (pick.length < 5 && remaining.length > 0) {
      pick.push(remaining.shift()!);
    }
  }

  return pick;
}

