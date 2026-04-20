import type { GameLocation } from '../types';

export async function fetchLocations(): Promise<GameLocation[]> {
  const res = await fetch('/api/locations');
  if (!res.ok) throw new Error(`fetch locations failed: ${res.status}`);
  return res.json();
}

export async function saveLocation(loc: GameLocation): Promise<{ count: number }> {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loc),
  });
  if (!res.ok) throw new Error(`save failed: ${res.status}`);
  return res.json();
}

export async function deleteLocation(id: string): Promise<{ count: number }> {
  const res = await fetch('/api/locations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
  return res.json();
}
