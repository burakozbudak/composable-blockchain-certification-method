"""Remotive - free, no-auth public API for remote job listings.
Docs: https://remotive.com/api/remote-jobs (add ?search= or ?category=)
"""

from __future__ import annotations

import requests

from ..util import make_job
from .base import REQUEST_TIMEOUT, USER_AGENT

API_URL = "https://remotive.com/api/remote-jobs"

# Categories that plausibly match the resume's multi-track profile.
CATEGORIES = ["software-dev", "all-others"]
SEARCH_TERMS = ["react", "python", "blockchain", "solidity", "process engineer", "chemical engineer"]


def fetch(categories=None, search_terms=None) -> list:
    jobs = []
    seen_ids = set()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for category in categories or CATEGORIES:
        resp = session.get(API_URL, params={"category": category}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        for raw in resp.json().get("jobs", []):
            if raw["id"] in seen_ids:
                continue
            seen_ids.add(raw["id"])
            jobs.append(_normalize(raw))

    for term in search_terms or SEARCH_TERMS:
        resp = session.get(API_URL, params={"search": term}, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        for raw in resp.json().get("jobs", []):
            if raw["id"] in seen_ids:
                continue
            seen_ids.add(raw["id"])
            jobs.append(_normalize(raw))

    return jobs


def _normalize(raw: dict) -> dict:
    return make_job(
        title=raw.get("title"),
        company=raw.get("company_name"),
        location=raw.get("candidate_required_location"),
        description=raw.get("description"),
        url=raw.get("url"),
        source="remotive",
        tags=raw.get("tags"),
        posted=raw.get("publication_date"),
    )
