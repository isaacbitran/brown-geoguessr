"""Comprehensive user-base analytics for Brown GeoGuessr."""

from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, quantiles

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
    params={"select": "date,username,total_m,created_at", "order": "created_at.asc"},
    timeout=30,
)
res.raise_for_status()
rows = res.json()

print(f"========== BROWN GEOGUESSR — USER BASE ANALYSIS ==========\n")
print(f"Pulled {len(rows)} total play submissions\n")

# ---------------- by-date breakdown ----------------
by_date = defaultdict(list)
for r in rows:
    by_date[r["date"]].append(r)

dates = sorted(by_date.keys())
all_users_ever = set(r["username"] for r in rows)

print(f"Total unique players ever:  {len(all_users_ever)}")
print(f"Total plays:                {len(rows)}")
print(f"Avg plays per player:       {len(rows) / len(all_users_ever):.2f}")
print(f"Game dates with activity:   {len(dates)}  ({dates[0]} → {dates[-1]})")
print()

print("---------- DAILY BREAKDOWN ----------")
print(f"{'Date':<12} {'Plays':>6} {'Unique':>7} {'New':>5} {'Returning':>10} {'Best':>6} {'Med':>6}")
seen_users = set()
prev_day_users = set()
day_stats = []
for d in dates:
    plays = by_date[d]
    users = set(p["username"] for p in plays)
    new_users = users - seen_users
    returning = users - new_users
    came_back = users & prev_day_users  # users who played both this day and prev
    best_per_user = {}
    for p in plays:
        u = p["username"]
        if u not in best_per_user or p["total_m"] < best_per_user[u]:
            best_per_user[u] = p["total_m"]
    scores = sorted(best_per_user.values())
    best = scores[0] if scores else 0
    med = median(scores) if scores else 0
    print(f"{d}   {len(plays):>6} {len(users):>7} {len(new_users):>5} {len(returning):>10} {best:>6}m {med:>6.0f}m")
    day_stats.append({
        "date": d,
        "users": users,
        "new": new_users,
        "returning_from_prev": came_back,
        "scores": scores,
    })
    seen_users |= users
    prev_day_users = users
print()

# ---------------- engagement ----------------
plays_per_user = Counter(r["username"] for r in rows)
play_dist = Counter(plays_per_user.values())
print("---------- ENGAGEMENT (plays per player) ----------")
print(f"{'Plays':>5} {'Players':>8}")
for n in sorted(play_dist):
    print(f"{n:>5} {play_dist[n]:>8}")
multi_play = sum(1 for c in plays_per_user.values() if c > 1)
print(f"\nPlayers who replayed at least once:  {multi_play}/{len(plays_per_user)} ({100*multi_play/len(plays_per_user):.1f}%)")
print()

# ---------------- retention (D1) ----------------
print("---------- DAY-1 RETENTION ----------")
print("(% of players from day N who also played day N+1)")
for i in range(len(day_stats) - 1):
    today = day_stats[i]["users"]
    tomorrow = day_stats[i + 1]["users"]
    retained = today & tomorrow
    pct = 100 * len(retained) / len(today) if today else 0
    print(f"  {day_stats[i]['date']} → {day_stats[i+1]['date']}: "
          f"{len(retained)}/{len(today)} retained ({pct:.1f}%)")
print()

# ---------------- cohort retention ----------------
print("---------- COHORT RETENTION ----------")
print("(of players whose FIRST play was on date X, how many returned on later dates)")
first_seen_date = {}
for r in rows:
    u = r["username"]
    if u not in first_seen_date or r["date"] < first_seen_date[u]:
        first_seen_date[u] = r["date"]
cohorts = defaultdict(set)
for u, d in first_seen_date.items():
    cohorts[d].add(u)
for cohort_date in sorted(cohorts.keys()):
    cohort = cohorts[cohort_date]
    print(f"\nCohort {cohort_date} ({len(cohort)} new players):")
    for d in sorted(by_date.keys()):
        if d <= cohort_date:
            continue
        active = cohort & set(p["username"] for p in by_date[d])
        days_later = (datetime.fromisoformat(d) - datetime.fromisoformat(cohort_date)).days
        pct = 100 * len(active) / len(cohort)
        print(f"  D+{days_later} ({d}): {len(active)}/{len(cohort)} returned ({pct:.1f}%)")

# ---------------- score distribution today ----------------
today_str = max(dates)
today_scores = day_stats[-1]["scores"]
print(f"\n---------- TODAY'S SCORE DISTRIBUTION ({today_str}) ----------")
if len(today_scores) >= 4:
    q = quantiles(today_scores, n=4)
    print(f"Best:    {today_scores[0]} m")
    print(f"Q1:      {q[0]:.0f} m")
    print(f"Median:  {q[1]:.0f} m")
    print(f"Q3:      {q[2]:.0f} m")
    print(f"Worst:   {today_scores[-1]} m")
    print(f"Mean:    {mean(today_scores):.0f} m")
print()

# ---------------- timing within days ----------------
print("---------- WHEN PEOPLE PLAY ----------")
for d in dates:
    hours = [
        datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
        .astimezone(timezone.utc).hour
        for p in by_date[d]
    ]
    if hours:
        print(f"  {d}: peak hour (UTC) = {Counter(hours).most_common(1)[0][0]:02d}:00, "
              f"first @ {min(hours):02d}, last @ {max(hours):02d}")
