"""Signed distance shapes (numpy, vectorised over points) and surface nets meshing.

Bodies are built as smooth unions of simple shapes, so muscles, joints and kit blend without seams. A shape is
(label, k, fn, lo, hi): fn(P) -> distance for points P (N,3); k = blend radius with what came before (negative =
smooth subtraction); [lo, hi] = bounding box, used to evaluate each shape only near itself.
"""
import numpy as np


def _v(a):
    return np.asarray(a, dtype=np.float64)


def norm(a):
    a = _v(a)
    return a / np.linalg.norm(a)


def frame(u, ref):
    """orthonormal rows (u, w, u x w) with w = ref made perpendicular to u"""
    u = norm(u)
    w = _v(ref) - u * np.dot(_v(ref), u)
    w = w / np.linalg.norm(w)
    return np.array([u, w, np.cross(u, w)])


def smin(a, b, k):
    if k <= 0:
        return np.minimum(a, b)
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b + (a - b) * h - k * h * (1 - h)


def smax(a, b, k):
    return -smin(-a, -b, k)


def ellipsoid(c, r, axes=None):
    c, r = _v(c), _v(r)

    def f(P):
        q = P - c
        if axes is not None:
            q = q @ _v(axes).T
        k0 = np.linalg.norm(q / r, axis=1)
        k1 = np.linalg.norm(q / (r * r), axis=1)
        return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
    e = r.max() if axes is not None else r
    return f, c - e, c + e


def sphere(c, r):
    c = _v(c)
    return (lambda P: np.linalg.norm(P - c, axis=1) - r), c - r, c + r


def cone(a, b, ra, rb):
    """round cone: spheres ra at a and rb at b joined by their tangent cone"""
    a, b = _v(a), _v(b)
    ba = b - a
    l2 = ba @ ba
    rr = ra - rb
    a2 = l2 - rr * rr
    il2 = 1.0 / l2

    def f(P):
        pa = P - a
        y = pa @ ba
        z = y - l2
        x2 = np.sum((pa * l2 - np.outer(y, ba)) ** 2, axis=1)
        y2 = y * y * l2
        z2 = z * z * l2
        k = np.sign(rr) * rr * rr * x2
        d = (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - ra
        d = np.where(np.sign(y) * a2 * y2 < k, np.sqrt(x2 + y2) * il2 - ra, d)
        d = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(x2 + z2) * il2 - rb, d)
        return d
    m = max(ra, rb)
    return f, np.minimum(a, b) - m, np.maximum(a, b) + m


def torus(c, axis, R, r, scale=(1, 1)):
    """ring around axis through c; scale stretches the ring radius along the two perpendicular axes"""
    c = _v(c)
    F = frame(axis, [1, 0, 0] if abs(norm(axis)[0]) < 0.9 else [0, 1, 0])
    s = _v(scale)

    def f(P):
        q = (P - c) @ F.T
        h = q[:, 0]
        rad = np.hypot(q[:, 1] / s[0], q[:, 2] / s[1])
        return np.hypot(rad - R, h) - r
    e = R * max(s) + r
    return f, c - e, c + e


def box(c, half, rad, axes=None):
    """rounded box: half extents (outer, including the rounding radius rad)"""
    c, half = _v(c), _v(half) - rad

    def f(P):
        q = P - c
        if axes is not None:
            q = q @ _v(axes).T
        q = np.abs(q) - half
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - rad
    e = (half + rad).max() if axes is not None else half + rad
    return f, c - e, c + e


def plane(p, n):
    """half-space behind the plane (n points outside)"""
    p, n = _v(p), norm(n)
    return (lambda P: (P - p) @ n), np.full(3, -9.0), np.full(3, 9.0)


def field(shapes, lo, hi, h, margin=0.05):
    """samples the smooth union of shapes on a grid; each shape only inside its box (+ margin)"""
    lo, hi = _v(lo), _v(hi)
    n = np.ceil((hi - lo) / h).astype(int) + 1
    F = np.full(n, 0.1, dtype=np.float32)
    for lab, k, fn, a, b in shapes:
        i0 = np.clip(np.floor((_v(a) - margin - abs(k) - lo) / h).astype(int), 0, n - 1)
        i1 = np.clip(np.ceil((_v(b) + margin + abs(k) - lo) / h).astype(int) + 1, 1, n)
        if np.any(i1 <= i0):
            continue
        ax = [lo[d] + h * np.arange(i0[d], i1[d]) for d in range(3)]
        G = np.stack(np.meshgrid(*ax, indexing='ij'), -1).reshape(-1, 3)
        d = fn(G).reshape(i1 - i0).astype(np.float32)
        sl = tuple(slice(i0[j], i1[j]) for j in range(3))
        F[sl] = smax(F[sl], -d, -k) if k < 0 else smin(F[sl], d, k)
    return F, lo, h


def surface_nets(F, lo, h):
    """quad mesh of the zero level set: one vertex per sign-changing cell (mean of its edge crossings), one quad per
    sign-changing grid edge. Returns (verts (V,3), quads (Q,4)) with outward winding."""
    inside = F < 0
    nx, ny, nz = F.shape
    S = np.zeros((nx - 1, ny - 1, nz - 1, 3), np.float32)
    C = np.zeros((nx - 1, ny - 1, nz - 1), np.int32)
    for ax in range(3):
        a = [slice(None)] * 3
        b = [slice(None)] * 3
        a[ax] = slice(0, -1)
        b[ax] = slice(1, None)
        f0, f1 = F[tuple(a)], F[tuple(b)]
        ch = inside[tuple(a)] != inside[tuple(b)]
        t = np.where(ch, f0 / np.where(ch, f0 - f1, 1), 0).astype(np.float32)
        pos = np.moveaxis(np.indices(f0.shape, dtype=np.float32), 0, -1)
        pos[..., ax] += t
        others = [d for d in range(3) if d != ax]
        for d0 in (0, 1):
            for d1 in (0, 1):
                s = [slice(None)] * 3
                s[ax] = slice(None)
                s[others[0]] = slice(d0, F.shape[others[0]] - 1 + d0)
                s[others[1]] = slice(d1, F.shape[others[1]] - 1 + d1)
                m = ch[tuple(s)]
                S += np.where(m[..., None], pos[tuple(s)], 0)
                C += m
    act = C > 0
    vid = np.full(C.shape, -1, np.int64)
    vid[act] = np.arange(act.sum())
    verts = lo + h * (S[act] / C[act][:, None])
    quads = []
    for ax in range(3):
        o = [d for d in range(3) if d != ax]
        a = [slice(None)] * 3
        b = [slice(None)] * 3
        a[ax] = slice(0, -1)
        b[ax] = slice(1, None)
        ch = inside[tuple(a)] != inside[tuple(b)]
        out = inside[tuple(a)]  # inside at the low end: outward is +ax
        e = np.argwhere(ch)
        e = e[(e[:, o[0]] > 0) & (e[:, o[0]] < F.shape[o[0]] - 1) & (e[:, o[1]] > 0) & (e[:, o[1]] < F.shape[o[1]] - 1)]
        fl = out[tuple(e.T)]

        def cell(d0, d1):
            c = e.copy()
            c[:, o[0]] -= d0
            c[:, o[1]] -= d1
            return vid[tuple(c.T)]
        # cyclic order around the edge, normal = +ax for the axis order (o0, o1) = (ax+1, ax+2)
        q = np.stack([cell(1, 1), cell(0, 1), cell(0, 0), cell(1, 0)], 1)
        if o != [(ax + 1) % 3, (ax + 2) % 3]:
            q = q[:, ::-1]
        q = np.where(fl[:, None], q, q[:, ::-1])
        quads.append(q)
    return verts, np.concatenate(quads)


def mesh(shapes, lo, hi, h):
    F, lo, h = field(shapes, lo, hi, h)
    return surface_nets(F, lo, h)


def label_of(shapes, P):
    """label of the nearest shape group at each point (smooth-subtracted shapes are ignored)"""
    labs = sorted({s[0] for s in shapes if s[1] >= 0})
    D = np.full((len(labs), len(P)), 9.0)
    for lab, k, fn, a, b in shapes:
        if k < 0:
            continue
        i = labs.index(lab)
        D[i] = np.minimum(D[i], fn(P))
    return np.array(labs)[np.argmin(D, axis=0)]
