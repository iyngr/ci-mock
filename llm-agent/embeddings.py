"""Embedding utility helpers: cosine similarity with NumPy fast-path and pure-Python fallback.

This module provides lightweight helpers for computing cosine similarity and
batch re-ranking. It intentionally has no hard dependency on NumPy: if NumPy
is available it will use it for a fast path; otherwise it falls back to
pure-Python implementations.

Usage:
    from embeddings import cosine_similarity, cosine_similarities_batch
"""
from typing import Iterable, List


def cosine_similarity(a: Iterable[float], b: Iterable[float]) -> float:
    """Compute cosine similarity between two vectors in [-1.0, 1.0].

    Uses NumPy when available for speed; otherwise uses a safe pure-Python
    implementation. Returns 0.0 for zero-norm vectors.
    """
    try:
        import numpy as _np

        a_np = _np.asarray(a, dtype=_np.float32)
        b_np = _np.asarray(b, dtype=_np.float32)
        if a_np.shape != b_np.shape:
            raise ValueError("Vector shapes do not match")
        na = _np.linalg.norm(a_np)
        nb = _np.linalg.norm(b_np)
        if na == 0.0 or nb == 0.0:
            return 0.0
        sim = float(_np.dot(a_np, b_np) / (na * nb))
        # numerical safety
        if sim != sim:  # NaN guard
            return 0.0
        return max(-1.0, min(1.0, sim))
    except Exception:
        # Pure-Python fallback
        import math

        a_list = list(a)
        b_list = list(b)
        if len(a_list) == 0 or len(a_list) != len(b_list):
            raise ValueError("Vectors must be same non-zero length")
        dot = 0.0
        sa = 0.0
        sb = 0.0
        for x, y in zip(a_list, b_list):
            dot += x * y
            sa += x * x
            sb += y * y
        if sa == 0.0 or sb == 0.0:
            return 0.0
        sim = dot / (math.sqrt(sa) * math.sqrt(sb))
        return max(-1.0, min(1.0, sim))


def cosine_similarities_batch(matrix: Iterable[Iterable[float]], query: Iterable[float]) -> List[float]:
    """Compute cosine similarities between each row in matrix and the query vector.

    Returns a list of floats in the same order as the input matrix.
    Uses NumPy fast path when available.
    """
    try:
        import numpy as _np

        M = _np.asarray(list(matrix), dtype=_np.float32)
        q = _np.asarray(list(query), dtype=_np.float32)
        if M.ndim != 2 or q.ndim != 1 or M.shape[1] != q.shape[0]:
            raise ValueError("Shape mismatch between matrix and query vector")
        dots = M @ q  # (N,)
        normsM = _np.linalg.norm(M, axis=1)
        normq = _np.linalg.norm(q)
        denom = normsM * (normq if normq != 0.0 else 1e-12)
        sims = dots / denom
        sims = _np.clip(sims, -1.0, 1.0)
        return sims.tolist()
    except Exception:
        # Pure-Python fallback
        import math

        qlist = list(query)
        qnorm = math.sqrt(sum(x * x for x in qlist))
        res = []
        for row in matrix:
            try:
                row_list = list(row)
                dot = sum(x * y for x, y in zip(row_list, qlist))
                rnorm = math.sqrt(sum(x * x for x in row_list))
                if qnorm == 0.0 or rnorm == 0.0:
                    res.append(0.0)
                else:
                    res.append(max(-1.0, min(1.0, dot / (qnorm * rnorm))))
            except Exception:
                res.append(0.0)
        return res
