"""Pull all plays from Supabase, plot cumulative unique players over time."""

import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import requests

ENV_PATH = Path(__file__).resolve().parent.parent / ".env.local"
env = {}
for line in ENV_PATH.read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()

url = env["VITE_SUPABASE_URL"]
key = env["VITE_SUPABASE_ANON_KEY"]

res = requests.get(
    f"{url}/rest/v1/plays",
    headers={"apikey": key, "Authorization": f"Bearer {key}"},
    params={"select": "username,created_at", "order": "created_at.asc"},
    timeout=30,
)
res.raise_for_status()
rows = res.json()
print(f"Fetched {len(rows)} total plays")

first_seen = {}
for r in rows:
    u = r["username"]
    if u not in first_seen:
        first_seen[u] = r["created_at"]

by_day_new = defaultdict(int)
for ts in first_seen.values():
    d = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
    by_day_new[d] += 1

days = sorted(by_day_new.keys())
new_each_day = [by_day_new[d] for d in days]
cumulative = []
total = 0
for n in new_each_day:
    total += n
    cumulative.append(total)

print(f"Total unique players: {total}")
print(f"Days with activity: {len(days)}")
for d, n, c in zip(days, new_each_day, cumulative):
    print(f"  {d}  +{n}  (total {c})")

fig, ax = plt.subplots(figsize=(9, 5), facecolor="#F5F1E8")
ax.set_facecolor("#F5F1E8")
ax.plot(days, cumulative, color="#8B1A1A", linewidth=2.5, marker="o", markersize=6)
ax.fill_between(days, cumulative, alpha=0.1, color="#8B1A1A")
ax.set_title("Brown GeoGuessr — Cumulative Unique Players", fontsize=14, color="#1F1B16")
ax.set_ylabel("Unique players", color="#6B6358")
ax.set_xlabel("Date", color="#6B6358")
ax.grid(True, alpha=0.3, color="#D9D1BE")
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.spines["left"].set_color("#D9D1BE")
ax.spines["bottom"].set_color("#D9D1BE")
ax.tick_params(colors="#6B6358")
fig.autofmt_xdate()
fig.tight_layout()

out = Path(__file__).resolve().parent / "growth.png"
fig.savefig(out, dpi=140, facecolor="#F5F1E8")
print(f"Chart saved: {out}")
