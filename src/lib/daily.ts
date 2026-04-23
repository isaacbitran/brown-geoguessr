import type { Difficulty, GameLocation } from '../types';

// New algorithm kicks in for dates >= this cutoff. Earlier dates keep using
// the legacy hash so today's leaderboard (and any historical re-derivation)
// stays consistent for players who are mid-edition when the fix deploys.
const NEW_ALGO_FROM = '2026-04-24';

// --- Legacy (for dates < NEW_ALGO_FROM) -----------------------------------
function seedFromDateLegacy(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededShuffleLegacy<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) | 0;
    const j = (s >>> 0) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- New (FNV-1a + mulberry32, well-distributed) --------------------------
function seedFromDateV2(dateStr: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffleV2<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  const rand = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- Dispatch -------------------------------------------------------------
function shuffleFor(date: string): {
  seed: (d: string) => number;
  shuffle: <T>(arr: T[], seed: number) => T[];
} {
  if (date >= NEW_ALGO_FROM) {
    return { seed: seedFromDateV2, shuffle: seededShuffleV2 };
  }
  return { seed: seedFromDateLegacy, shuffle: seededShuffleLegacy };
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
  // Free play always uses the new shuffle.
  return pickWithSeed(all, seed, seededShuffleV2);
}

export function pickDailyLocations(
  all: GameLocation[],
  dateStr?: string
): GameLocation[] {
  const date = dateStr ?? todayDateStr();
  const { seed, shuffle } = shuffleFor(date);
  return pickWithSeed(all, seed(date), shuffle);
}

function pickWithSeed(
  all: GameLocation[],
  seed: number,
  shuffle: <T>(arr: T[], seed: number) => T[]
): GameLocation[] {
  const byDiff = (d: Difficulty) => all.filter((l) => l.difficulty === d);
  const easy = shuffle(byDiff('easy'), seed);
  const medium = shuffle(byDiff('medium'), seed + 1);
  const hard = shuffle(byDiff('hard'), seed + 2);

  const pick = [
    ...easy.slice(0, 2),
    ...medium.slice(0, 2),
    ...hard.slice(0, 1),
  ];

  // Pad if a pool is too small — never crash.
  if (pick.length < 5) {
    const used = new Set(pick.map((l) => l.id));
    const remaining = shuffle(
      all.filter((l) => !used.has(l.id)),
      seed + 3
    );
    while (pick.length < 5 && remaining.length > 0) {
      pick.push(remaining.shift()!);
    }
  }

  return pick;
}

