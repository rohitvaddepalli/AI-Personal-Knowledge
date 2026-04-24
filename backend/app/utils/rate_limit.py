from __future__ import annotations

import time
from collections import defaultdict, deque


_WINDOWS: dict[str, deque[float]] = defaultdict(deque)


def check_rate_limit(key: str, limit: int, period_seconds: int = 60) -> bool:
    now = time.time()
    window = _WINDOWS[key]
    while window and now - window[0] > period_seconds:
        window.popleft()
    if len(window) >= limit:
        return False
    window.append(now)
    return True
