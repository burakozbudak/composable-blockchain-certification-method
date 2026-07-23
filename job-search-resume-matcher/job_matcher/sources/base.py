from __future__ import annotations

import logging

logger = logging.getLogger("job_matcher.sources")

USER_AGENT = "job-search-resume-matcher/1.0 (personal use; contact: burakozbudak1@gmail.com)"
REQUEST_TIMEOUT = 20


def safe_fetch(fetch_fn, source_name: str) -> list:
    """Run a source's fetch function, never let one dead/rate-limited API kill the run."""
    try:
        jobs = fetch_fn()
        logger.info("%s: fetched %d postings", source_name, len(jobs))
        return jobs
    except Exception as exc:  # noqa: BLE001 - intentionally broad, this is a best-effort aggregator
        logger.warning("%s: fetch failed (%s) - skipping this source", source_name, exc)
        return []
