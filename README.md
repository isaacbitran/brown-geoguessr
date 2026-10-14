# Brown GeoGuessr

[browngeoguessr.com](https://browngeoguessr.com) — a daily campus geography game for Brown. You get dropped somewhere on campus in Street View and guess where you are on the map. 500+ players in the first week after it spread on Sidechat; 534 by Sept 2026.

## How it works
- **Daily edition.** Everyone gets the same rounds each day: the date is hashed (FNV-1a) into a seeded shuffle (mulberry32) over the location pool, so there is no server-side scheduling and any past day can be re-derived.
- **Locations.** 216 hand-picked spots in `src/data/locations.json`, each with lat/lng, heading, pitch and difficulty, picked with a built-in curator tool (`/curate`).
- **Street View.** Google Maps JS, positioned with `setPosition()` only, so the answer is never in a URL or pano ID the player can read.
- **Scores.** Supabase stores plays and powers the daily leaderboard.
- **Stack.** Vite, React, TypeScript, Tailwind. Deployed on Vercel.

`scripts/` holds the Python I use to check the daily rotation and read player growth.

## Run
```
npm install
cp .env.example .env   # Google Maps key + Supabase URL / anon key
npm run dev
```
