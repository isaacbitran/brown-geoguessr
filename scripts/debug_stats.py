"""Show plays grouped by date, so we can see what fetchPlayerStats would count."""

from collections import defaultdict
from pathlib import Path
import requests

ENV = Path(__file__).resolve().parent.parent / ".env.local"
env = {}
for line in ENV.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()

url = env["VITE_SUPABASE_URL"]
key = env["VITE_SUPABASE_ANON_KEY"]

res = requests.get(
    f"{url}/rest/v1/plays",
    headers={"apikey": key, "Authorization": f"Bearer {key}"},
    params={"select": "date,username,total_m,created_at", "order": "date.asc,total_m.asc"},
    timeout=30,
)
res.raise_for_status()
rows = res.json()

by_date = defaultdict(list)
for r in rows:
    by_date[r["date"]].append(r)

print(f"{len(rows)} total plays across {len(by_date)} game dates\n")

for date in sorted(by_date.keys()):
    plays = by_date[date]
    # best-per-user for this date
    best = {}
    for p in plays:
        u = p["username"]
        if u not in best or p["total_m"] < best[u]["total_m"]:
            best[u] = p
    sorted_best = sorted(best.values(), key=lambda p: p["total_m"])
    print(f"=== {date} — {len(sorted_best)} unique players, {len(plays)} total plays ===")
    for i, p in enumerate(sorted_best[:10]):
        print(f"  #{i + 1}  {p['username']:<20}  {p['total_m']:>6} m")
    print()
