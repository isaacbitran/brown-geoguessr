export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameLocation {
  id: string;
  lat: number;
  lng: number;
  panoId: string | null;
  heading: number;
  pitch: number;
  difficulty: Difficulty;
}

export interface RoundResult {
  location: GameLocation;
  guess: { lat: number; lng: number } | null;
  distanceM: number;
}
