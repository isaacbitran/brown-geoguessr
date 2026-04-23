"""Verify the wins/top-10 tracking by recomputing from raw plays data.

Mirrors the JS fetchPlayerStats logic: per past date (excluding today),
de-dupe to best score per user, count wins (anyone tied at min total) and
top-10 finishes."""

from collections import defaultdict
from datetime import date
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

TODAY = date.today().isoformat()
print(f"Today is {TODAY} (excluded from stats since it's not final)\n")

res = requests.get(
    f"{url}/rest/v1/plays",
    headers={"apikey": key, "Authorization": f"Bearer {key}"},
    params={"select": "date,username,total_m", "order": "date.asc"},
    timeout=30,
)
res.raise_for_status()
rows = res.json()

# date -> username -> best score (mirrors fetchPlayerStats's dedup)
by_date_user = defaultdict(dict)
for r in rows:
    if r["date"] == TODAY:
        continue
    d = r["date"]
    u = r["username"]
    if u not in by_date_user[d] or r["total_m"] < by_date_user[d][u]:
        by_date_user[d][u] = r["total_m"]

# Compute wins + top10 per user
stats = defaultdict(lambda: {"wins": 0, "top10": 0})
print("============ PER-DATE WINNERS + TOP 10 ============\n")
for d in sorted(by_date_user.keys()):
    users = by_date_user[d]
    sorted_players = sorted(users.items(), key=lambda x: x[1])
    if not sorted_players:
        continue
    min_m = sorted_players[0][1]
    winners = [u for u, m in sorted_players if m == min_m]
    top10 = [u for u, _ in sorted_players[:10]]

    print(f"--- {d} ---")
    print(f"  Winner(s): {', '.join(f'{u} ({m}m)' for u, m in sorted_players if m == min_m)}")
    print("  Top 10:")
    for i, (u, m) in enumerate(sorted_players[:10]):
        marker = " 🥇" if m == min_m else ""
        print(f"    {i+1:>2}. {u:<22} {m:>5}m{marker}")
    print()

    for w in winners:
        stats[w]["wins"] += 1
    for u in top10:
        stats[u]["top10"] += 1

# Aggregated stats
print("============ AGGREGATED PLAYER STATS ============\n")
print(f"{'Player':<25} {'Wins':>5} {'Top-10':>7}")
print("-" * 40)
sorted_stats = sorted(
    stats.items(), key=lambda x: (-x[1]["wins"], -x[1]["top10"], x[0])
)
for u, s in sorted_stats[:30]:
    print(f"{u:<25} {s['wins']:>5} {s['top10']:>7}")
print(f"\nTotal players with at least 1 win:   {sum(1 for s in stats.values() if s['wins'] > 0)}")
print(f"Total players with at least 1 top-10: {sum(1 for s in stats.values() if s['top10'] > 0)}")

# Cross-check: who's playing TODAY who has past medals?
print("\n============ TODAY'S LEADERBOARD: who SHOULD show medals ============")
today_players = set(r["username"] for r in rows if r["date"] == TODAY)
today_with_history = sorted(
    [(u, stats[u]["wins"], stats[u]["top10"])
     for u in today_players if stats[u]["wins"] > 0 or stats[u]["top10"] > 0],
    key=lambda x: (-x[1], -x[2], x[0]),
)
if today_with_history:
    print(f"{'Player':<25} {'Wins':>5} {'Top-10':>7}")
    for u, w, t in today_with_history:
        print(f"{u:<25} {w:>5} {t:>7}")
else:
    print("(none — no players from past wins/top-10 have played today yet)")
