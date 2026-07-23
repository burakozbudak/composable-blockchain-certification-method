"""RemoteOK - free public API. Requires a realistic User-Agent or it returns 403.
Docs: https://remoteok.com/api
"""

from __future__ import annotations

import requests

from ..util import make_job
from .base import REQUEST_TIMEOUT

API_URL = "https://remoteok.com/api"

BROWSER_UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0 Safari/537.36"
)


def fetch() -> list:
    resp = requests.get(API_URL, headers={"User-Agent": BROWSER_UA}, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    # First element is a legal notice, not a job.
    return [_normalize(raw) for raw in data if isinstance(raw, dict) and raw.get("position")]


def _normalize(raw: dict) -> dict:
    return make_job(
        title=raw.get("position"),
        company=raw.get("company"),
        location=raw.get("location") or "Remote",
        description=raw.get("description"),
        url=raw.get("url") or raw.get("apply_url"),
        source="remoteok",
        tags=raw.get("tags"),
        posted=raw.get("date"),
    )
