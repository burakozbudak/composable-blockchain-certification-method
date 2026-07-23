"""Jobicy - free, no-auth public API for remote job listings.
Docs: https://jobicy.com/jobs-rss-feed (JSON API: /api/v2/remote-jobs)
"""

from __future__ import annotations

import requests

from ..util import make_job
from .base import REQUEST_TIMEOUT, USER_AGENT

API_URL = "https://jobicy.com/api/v2/remote-jobs"

# Jobicy tags relevant to the resume's tracks.
TAGS = ["dev", "engineer", "python", "blockchain"]


def fetch(tags=None, count: int = 50) -> list:
    jobs = []
    seen_ids = set()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for tag in tags or TAGS:
        resp = session.get(API_URL, params={"count": count, "tag": tag}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        for raw in resp.json().get("jobs", []):
            job_id = raw.get("id")
            if job_id in seen_ids:
                continue
            seen_ids.add(job_id)
            jobs.append(_normalize(raw))

    return jobs


def _normalize(raw: dict) -> dict:
    return make_job(
        title=raw.get("jobTitle"),
        company=raw.get("companyName"),
        location=raw.get("jobGeo"),
        description=raw.get("jobDescription") or raw.get("jobExcerpt"),
        url=raw.get("url"),
        source="jobicy",
        tags=raw.get("jobIndustry") or raw.get("tags"),
        posted=raw.get("pubDate"),
    )
