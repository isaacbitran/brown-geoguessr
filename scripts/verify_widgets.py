"""Verify all three left-widget data sources mirror what fetchTopRecords /
fetchTopWins / fetchTopStreaks return in the JS. Also spot-checks the
yesterday-podium fetcher."""

from collections import defaultdict
from datetime import date, timedelta
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
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()

res = requests.get(
    f"{url}/rest/v1/plays",
    headers={"apikey": key, "Authorization": f"Bearer {key}"},
    params={"select": "username,total_m,date,created_at", "order": "created_at.asc"},
    timeout=30,
)
res.raise_for_status()
rows = res.json()
print(f"Pulled {len(rows)} plays. Today={TODAY}, Yesterday={YESTERDAY}\n")

# ---------- ALL-TIME RECORDS (top 5 by min total_m, deduped per player) ----------
print("==== ALL-TIME RECORDS (expected top 5 by lowest score, deduped) ====")
by_user_best = {}
for r in rows:
    u = r["username"]
    if u not in by_user_best or r["total_m"] < by_user_best[u]["total_m"]:
        by_user_best[u] = r
top_records = sorted(by_user_best.values(), key=lambda x: x["total_m"])[:5]
for i, r in enumerate(top_records):
    print(f"  {i+1}. {r['username']:<22} {r['total_m']:>6} m   ({r['date']})")
print()

# ---------- MOST WINS (player wins past dates, top 5) ----------
print("==== MOST WINS (top 5 by past-date wins, today excluded) ====")
by_date_user_best = defaultdict(dict)
for r in rows:
    if r["date"] >= TODAY:
        continue
    u = r["username"]
    if u not in by_date_user_best[r["date"]] or r["total_m"] < by_date_user_best[r["date"]][u]:
        by_date_user_best[r["date"]][u] = r["total_m"]
wins = defaultdict(int)
for users in by_date_user_best.values():
    if not users:
        continue
    min_m = min(users.values())
    for u, m in users.items():
        if m == min_m:
            wins[u] += 1
top_wins = sorted(wins.items(), key=lambda x: (-x[1], x[0]))[:5]
for i, (u, n) in enumerate(top_wins):
    print(f"  {i+1}. {u:<22} {n:>3} {'win' if n == 1 else 'wins'}")
print()

# ---------- TOP STREAKS (current consecutive-day streak, top 5) ----------
print(f"==== TOP STREAKS (active streaks ending today/yesterday, top 5) ====")
dates_by_user = defaultdict(set)
for r in rows:
    dates_by_user[r["username"]].add(r["date"])
streaks = []
for u, dates in dates_by_user.items():
    most_recent = max(dates)
    if most_recent < YESTERDAY:
        continue  # streak broken
    streak = 0
    cursor = most_recent
    while cursor in dates:
        streak += 1
        cursor = (date.fromisoformat(cursor) - timedelta(days=1)).isoformat()
    streaks.append((u, streak, most_recent))
streaks.sort(key=lambda x: (-x[1], x[0]))
for i, (u, n, last) in enumerate(streaks[:5]):
    print(f"  {i+1}. {u:<22} {n:>2} {'day' if n == 1 else 'days'}   (last: {last})")
print()

# ---------- YESTERDAY'S PODIUM ----------
print(f"==== YESTERDAY'S PODIUM ({YESTERDAY}) ====")
y_users = by_date_user_best.get(YESTERDAY, {})
podium = sorted(y_users.items(), key=lambda x: x[1])[:3]
medals = ["🥇", "🥈", "🥉"]
for i, (u, m) in enumerate(podium):
    print(f"  {medals[i]} {u:<22} {m} m")
print()

# ---------- SANITY CHECKS ----------
print("==== SANITY CHECKS ====")
# Suspicious scores (above 100k = should be impossible legit: 5 timeouts × 10k = 50k)
suspect = [r for r in rows if r["total_m"] > 100_000]
print(f"Plays with implausibly high totals (>100,000 m): {len(suspect)}")
for r in suspect[:5]:
    print(f"  {r['date']}  {r['username']:<22}  {r['total_m']:>12} m")
# Plays scored 0
zero = [r for r in rows if r["total_m"] == 0]
print(f"Plays with total_m == 0: {len(zero)}")
# Negative scores (should never)
neg = [r for r in rows if r["total_m"] < 0]
print(f"Plays with negative total_m: {len(neg)}")
