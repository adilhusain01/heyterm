#!/usr/bin/env python3
# How long your Claude Code sessions sat finished or waiting while you were busy in another one.
# Reads the transcripts in ~/.claude/projects. Usage: python3 scripts/measure-waits.py [folder] [days]
# For each session: when a turn ended (the last assistant entry before your next prompt), how long until
# you prompted it again, and whether you prompted a different session in between.
import json, sys, glob, os, datetime as dt, collections
root = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/.claude/projects")
days = int(sys.argv[2]) if len(sys.argv) > 2 else 14
cut = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
def ts(s): return dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
def is_human(e):
    if e.get("type") != "user" or e.get("isMeta") or e.get("isSidechain"): return False
    c = e.get("message", {}).get("content")
    if isinstance(c, str): return not c.startswith("<")
    if isinstance(c, list): return any(p.get("type") == "text" and not p.get("text","").startswith("<") for p in c)
    return False
sessions = collections.defaultdict(list)
for f in glob.glob(os.path.join(root, "**/*.jsonl"), recursive=True):
    if dt.datetime.fromtimestamp(os.path.getmtime(f), dt.timezone.utc) < cut: continue
    for line in open(f, errors="ignore"):
        try: e = json.loads(line)
        except Exception: continue
        if "timestamp" not in e or e.get("isSidechain"): continue
        t = ts(e["timestamp"])
        if t < cut: continue
        kind = "human" if is_human(e) else ("assistant" if e.get("type") == "assistant" else None)
        if kind: sessions[e.get("sessionId")].append((t, kind, e.get("cwd","")))
humans = sorted((t, sid) for sid, ev in sessions.items() for t, k, _ in ev if k == "human")
waits = []
for sid, ev in sessions.items():
    ev.sort(); last_assistant = None
    for t, k, cwd in ev:
        if k == "assistant": last_assistant = (t, cwd)
        elif k == "human" and last_assistant:
            start, cwd0 = last_assistant; gap = (t - start).total_seconds()
            if 30 < gap < 4*3600:
                elsewhere = [h for h, s in humans if start < h < t and s != sid]
                waits.append((gap, len(elsewhere) > 0, cwd0, start))
            last_assistant = None
busy = [w for w in waits if w[1]]
print("sessions", len(sessions), "human prompts", len(humans), "turn ends answered", len(waits))
print("waits while you were prompting another session:", len(busy))
tot = sum(w[0] for w in busy)
print("total waiting while busy elsewhere: %.1f h, median %.1f min, longest %.0f min" % (tot/3600, sorted(w[0] for w in busy)[len(busy)//2]/60 if busy else 0, max((w[0] for w in busy), default=0)/60))
over10 = [w for w in busy if w[0] > 600]
print("waits over 10 min while busy elsewhere:", len(over10), "summing %.1f h" % (sum(w[0] for w in over10)/3600))
# peak concurrency: sessions with activity in the same 10-minute window
buckets = collections.defaultdict(set)
for sid, ev in sessions.items():
    for t, k, _ in ev: buckets[t.replace(minute=t.minute//10*10, second=0, microsecond=0)].add(sid)
print("max sessions active in one 10-minute window:", max((len(v) for v in buckets.values()), default=0))
print("projects:", collections.Counter(os.path.basename(w[2]) for w in busy).most_common(8))
