#!/usr/bin/env python3
"""Draw a 180x180 home-screen icon with no dependencies: a diagonal gradient
plus a simple white motif. Usage:

    python3 tools/make-icon.py games/2048/icon.png f2b179 edc22e tiles

Motifs: tiles (2x2 grid), cards (two overlapping rects), grid (5x5 dots),
dots (three dots joined), path (a bent pipe), rings (concentric), shapes.
"""
import sys, zlib, struct, math

W = H = 180

def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def png(rows):
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    def chunk(t, d):
        c = struct.pack('>I', len(d)) + t + d
        return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))

def rrect(x, y, w, h, r):
    def f(px, py):
        cx = min(max(px, x + r), x + w - r)
        cy = min(max(py, y + r), y + h - r)
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
    return f

def circle(cx, cy, r):
    return lambda px, py: (px - cx) ** 2 + (py - cy) ** 2 <= r * r

def motif(name):
    shapes = []   # (predicate, alpha)
    if name == 'tiles':
        for i in range(2):
            for j in range(2):
                shapes.append((rrect(38 + j * 56, 38 + i * 56, 48, 48, 10), 0.92 if (i + j) % 2 == 0 else 0.55))
    elif name == 'cards':
        shapes.append((rrect(34, 44, 62, 84, 12), 0.6))
        shapes.append((rrect(84, 52, 62, 84, 12), 0.95))
    elif name == 'grid':
        for i in range(5):
            for j in range(5):
                on = ((i * 3 + j * 5) % 4) < 2
                shapes.append((rrect(34 + j * 23, 34 + i * 23, 19, 19, 4), 0.95 if on else 0.28))
    elif name == 'dots':
        pts = [(46, 124), (90, 60), (134, 116)]
        for a, b in zip(pts, pts[1:]):
            n = 30
            for k in range(n + 1):
                t = k / n
                shapes.append((circle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 5), 0.7))
        for p in pts:
            shapes.append((circle(p[0], p[1], 15), 0.95))
    elif name == 'path':
        for k in range(40):
            shapes.append((circle(44 + k * 1.2, 56, 14), 0.9))
        for k in range(40):
            shapes.append((circle(92, 56 + k * 1.6, 14), 0.9))
        for k in range(40):
            shapes.append((circle(92 + k * 1.2, 120, 14), 0.9))
        shapes.append((circle(44, 56, 20), 0.95))
        shapes.append((circle(140, 120, 20), 0.95))
    elif name == 'rings':
        shapes.append((circle(90, 90, 62), 0.95))
        shapes.append((circle(90, 90, 46), -1))
        shapes.append((circle(90, 90, 30), 0.95))
        shapes.append((circle(90, 90, 14), -1))
    elif name == 'shapes':
        # a square, a triangle and a parallelogram, like tangram pieces
        shapes.append((rrect(34, 34, 54, 54, 6), 0.95))
        def tri(px, py): return px >= 96 and py >= 34 and (px - 96) + (py - 34) <= 56
        shapes.append((tri, 0.75))
        def par(px, py): return 96 <= py <= 146 and (py - 96) * 0.6 + 34 <= px <= (py - 96) * 0.6 + 100
        shapes.append((par, 0.6))
    return shapes

def main():
    out, c1, c2, name = sys.argv[1], hexrgb(sys.argv[2]), hexrgb(sys.argv[3]), sys.argv[4]
    shapes = motif(name)
    rows = []
    for y in range(H):
        row = []
        for x in range(W):
            t = (x + y) / (W + H - 2)
            r, g, b = [c1[i] + (c2[i] - c1[i]) * t for i in range(3)]
            for pred, a in shapes:
                if pred(x + 0.5, y + 0.5):
                    if a < 0:   # cut-out: restore the gradient
                        r, g, b = [c1[i] + (c2[i] - c1[i]) * t for i in range(3)]
                    else:
                        r, g, b = r + (255 - r) * a, g + (255 - g) * a, b + (255 - b) * a
            row += [int(r), int(g), int(b)]
        rows.append(row)
    open(out, 'wb').write(png(rows))
    print('wrote', out)

if __name__ == '__main__':
    main()
