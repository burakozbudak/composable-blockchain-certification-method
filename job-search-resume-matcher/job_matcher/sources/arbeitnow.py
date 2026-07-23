"""Arbeitnow - free, no-auth public job board API, Europe-heavy but includes
remote-anywhere and non-EU postings too.
Docs: https://www.arbeitnow.com/api/job-board-api
"""

from __future__ import annotations

import requests

from ..util import make_job
from .base import REQUEST_TIMEOUT, USER_AGENT

API_URL = "https://www.arbeitnow.com/api/job-board-api"
MAX_PAGES = 5  # the API paginates ~100 jobs/page; cap to keep runs fast


def fetch(max_pages: int = MAX_PAGES) -> list:
    jobs = []
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    url = API_URL
    for _ in range(max_pages):
        if not url:
            break
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        payload = resp.json()
        for raw in payload.get("data", []):
            jobs.append(_normalize(raw))
        url = (payload.get("links") or {}).get("next")

    return jobs


def _normalize(raw: dict) -> dict:
    location = raw.get("location") or ("Remote" if raw.get("remote") else "")
    return make_job(
        title=raw.get("title"),
        company=raw.get("company_name"),
        location=location,
        description=raw.get("description"),
        url=raw.get("url"),
        source="arbeitnow",
        tags=raw.get("tags"),
        posted=raw.get("created_at"),
    )
