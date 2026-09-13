#!/usr/bin/env python3
"""Check that every Nonogram puzzle in games/nonogram/js/puzzles-data.js can be
solved by line logic alone (no guessing), which is what makes a nonogram fair
for a kid. Prints one line per puzzle.

    python3 tools/nono-check.py
"""
import re, os, sys, itertools, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'games', 'nonogram', 'js', 'puzzles-data.js')

def clues(line):
    out, run = [], 0
    for v in line:
        if v: run += 1
        elif run: out.append(run); run = 0
    if run: out.append(run)
    return out or [0]

def placements(clue, n):
    """All fillings of a line of length n matching clue."""
    if clue == [0]:
        yield [0] * n; return
    k = len(clue)
    free = n - sum(clue) - (k - 1)
    if free < 0: return
    for gaps in itertools.combinations(range(free + k), k):
        line, pos, prev = [], 0, -1
        for i, g in enumerate(gaps):
            lead = g - prev - 1
            line += [0] * lead + [1] * clue[i] + ([0] if i < k - 1 else [])
            prev = g
        line += [0] * (n - len(line))
        yield line

def solve_line(clue, cur):
    """cur: list of -1 unknown / 0 / 1. Return refined line or None if stuck."""
    n = len(cur)
    cands = [p for p in placements(clue, n) if all(c < 0 or c == p[i] for i, c in enumerate(cur))]
    if not cands: return None
    out = []
    for i in range(n):
        s = {p[i] for p in cands}
        out.append(s.pop() if len(s) == 1 else -1)
    return out

def line_solvable(grid):
    h, w = len(grid), len(grid[0])
    rc = [clues(r) for r in grid]
    cc = [clues([grid[y][x] for y in range(h)]) for x in range(w)]
    cur = [[-1] * w for _ in range(h)]
    changed = True
    while changed:
        changed = False
        for y in range(h):
            new = solve_line(rc[y], cur[y])
            if new is None: return False
            if new != cur[y]: cur[y] = new; changed = True
        for x in range(w):
            col = [cur[y][x] for y in range(h)]
            new = solve_line(cc[x], col)
            if new is None: return False
            if new != col:
                for y in range(h): cur[y][x] = new[y]
                changed = True
    return all(v >= 0 for row in cur for v in row)

src = open(SRC).read()
m = re.search(r'var NONO_PUZZLES = (\[.*?\n\]);', src, re.S)
body = m.group(1)
# the file is JS but written as JSON-compatible literals
data = json.loads(re.sub(r'//.*', '', body))
bad = 0
for p in data:
    grid = [[1 if ch == '#' else 0 for ch in row] for row in p['art']]
    ok = line_solvable(grid)
    widths = {len(r) for r in p['art']}
    if len(widths) != 1: ok = False
    print(('ok  ' if ok else 'BAD ') + p['id'] + ' ' + str(len(grid[0])) + 'x' + str(len(grid)))
    bad += not ok
sys.exit(1 if bad else 0)
