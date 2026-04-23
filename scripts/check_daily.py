"""Mirror the JS daily.ts logic to check what locations get picked each day."""

import json
from datetime import date, timedelta
from pathlib import Path

LOCATIONS = json.loads(
    (Path(__file__).resolve().parent.parent / "src/data/locations.json").read_text()
)
ALL = [l for l in LOCATIONS if not (l.get("panoId") or "").startswith("CAoS")]


def imul(a, b):
    a &= 0xFFFFFFFF
    b &= 0xFFFFFFFF
    if a & 0x80000000:
        a -= 0x100000000
    if b & 0x80000000:
        b -= 0x100000000
    return (a * b) & 0xFFFFFFFF


def seed_from_date(s: str) -> int:
    # FNV-1a — much better distribution than the old hash*31+char.
    h = 0x811c9dc5
    for c in s:
        h ^= ord(c)
        h = imul(h, 0x01000193)
    return h & 0xFFFFFFFF


def mulberry32(seed):
    s = [seed & 0xFFFFFFFF]
    def rand():
        s[0] = (s[0] + 0x6D2B79F5) & 0xFFFFFFFF
        t = s[0]
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rand


def seeded_shuffle(arr, seed):
    copy = list(arr)
    rand = mulberry32(seed)
    for i in range(len(copy) - 1, 0, -1):
        j = int(rand() * (i + 1))
        copy[i], copy[j] = copy[j], copy[i]
    return copy


def pick_daily(date_str: str):
    seed = seed_from_date(date_str)
    by_diff = {
        d: [l for l in ALL if l["difficulty"] == d]
        for d in ("easy", "medium", "hard")
    }
    easy = seeded_shuffle(by_diff["easy"], seed)
    medium = seeded_shuffle(by_diff["medium"], seed + 1)
    hard = seeded_shuffle(by_diff["hard"], seed + 2)
    return easy[:2] + medium[:2] + hard[:1]


# Show last 10 days
today = date(2026, 4, 23)
print(f"Easy pool size: {len([l for l in ALL if l['difficulty'] == 'easy'])}")
print(f"Medium pool size: {len([l for l in ALL if l['difficulty'] == 'medium'])}")
print(f"Hard pool size: {len([l for l in ALL if l['difficulty'] == 'hard'])}")
print()
for d in range(-10, 5):
    day = today + timedelta(days=d)
    s = day.isoformat()
    picks = pick_daily(s)
    print(f"{s}  seed={seed_from_date(s)}")
    for p in picks:
        print(f"    {p['difficulty']:<6} {p['id']}  ({p['lat']:.4f}, {p['lng']:.4f})")
