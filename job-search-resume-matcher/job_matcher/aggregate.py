from __future__ import annotations

import json
import logging
from pathlib import Path

from .sources import arbeitnow, jobicy, remoteok, remotive
from .sources.base import safe_fetch

logger = logging.getLogger("job_matcher.aggregate")

SOURCES = {
    "remotive": remotive.fetch,
    "arbeitnow": arbeitnow.fetch,
    "jobicy": jobicy.fetch,
    "remoteok": remoteok.fetch,
}


def fetch_all(sources=None) -> list:
    """Hit every live source, skip any that fail, return the combined raw job list.

    Turkey-specific boards (Kariyer.net, Secretcv, LinkedIn, Indeed Turkey)
    don't expose a free public JSON API, so they aren't wired in here - see
    the README's "Turkey-market coverage" section for the manual workaround.
    """
    all_jobs = []
    for name in sources or SOURCES:
        fetch_fn = SOURCES[name]
        all_jobs.extend(safe_fetch(fetch_fn, name))
    return all_jobs


def load_offline_fixture() -> list:
    fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "sample_jobs.json"
    return json.loads(fixture_path.read_text())
