"""
In-process background job scheduler. Currently has no jobs registered
— the two that used to live here (calendar drift polling, pending-
appointment expiry) were removed along with the booking feature.
Kept as a scaffold: start()/stop() are safe no-ops, so main.py's
startup/shutdown hooks don't need to change, and the next feature that
needs a recurring background job (e.g. cart/orders) has somewhere to
add one.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

logger = logging.getLogger("jdk.scheduler")

_scheduler: BackgroundScheduler | None = None


def start() -> None:
    """Called once from main.py's startup hook."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.start()


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
