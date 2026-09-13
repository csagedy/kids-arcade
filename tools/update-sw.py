#!/usr/bin/env python3
"""Regenerate the precache list in sw.js from the files on disk and bump the
cache version. Run after adding or changing any file:

    python3 tools/update-sw.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SW = os.path.join(ROOT, 'sw.js')
SKIP_DIRS = {'.git', 'tools', 'node_modules', '.claude'}
SKIP_FILES = {'sw.js', 'README.md', 'diag.html', '.DS_Store', '.gitignore'}
EXT = {'.html', '.css', '.js', '.png', '.webmanifest', '.json', '.svg', '.woff2', '.mp3', '.wav'}

files = ['./']
for d, dirs, names in os.walk(ROOT):
    dirs[:] = sorted(x for x in dirs if x not in SKIP_DIRS and not x.startswith('.'))
    rel = os.path.relpath(d, ROOT)
    for n in sorted(names):
        if n in SKIP_FILES or os.path.splitext(n)[1] not in EXT:
            continue
        p = n if rel == '.' else rel + '/' + n
        files.append('./' + p)

src = open(SW).read()
m = re.search(r"var CACHE = 'arcade-v(\d+)';", src)
ver = int(m.group(1)) + 1
src = src.replace(m.group(0), "var CACHE = 'arcade-v%d';" % ver)

body = ',\n'.join('  ' + repr(f).replace('"', "'") for f in files)
src = re.sub(r"var FILES = \[.*?\n\];", "var FILES = [\n" + body + "\n];", src, flags=re.S)
open(SW, 'w').write(src)
print('sw.js: %d files, cache arcade-v%d' % (len(files), ver))
