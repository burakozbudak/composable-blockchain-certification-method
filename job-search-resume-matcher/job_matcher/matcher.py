"""Score a normalized job posting against Burak's resume skill taxonomy."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .location import classify_location
from .profile import SKILL_TRACKS


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).lower()


@dataclass
class MatchResult:
    job: dict
    score: float
    track_scores: dict
    matched_keywords: list
    location_category: str
    location_eligible: bool
    location_flags: list


def score_job(job: dict) -> MatchResult:
    """job is a normalized dict with at least: title, company, location, description, url, source."""
    haystack = _normalize(
        f"{job.get('title', '')} {job.get('description', '')} {job.get('tags', '')}"
    )

    track_scores = {}
    matched = []
    for track, cfg in SKILL_TRACKS.items():
        hits = [kw for kw in cfg["keywords"] if kw in haystack]
        if hits:
            matched.extend(hits)
        # Diminishing returns per extra keyword hit within a track so one very
        # keyword-stuffed track can't dominate the total score.
        track_score = cfg["weight"] * sum(1 / (1 + i) for i in range(len(hits)))
        track_scores[track] = round(track_score, 3)

    total = round(sum(track_scores.values()), 3)

    loc = classify_location(job.get("location", ""))

    return MatchResult(
        job=job,
        score=total,
        track_scores=track_scores,
        matched_keywords=sorted(set(matched)),
        location_category=loc.category,
        location_eligible=loc.eligible,
        location_flags=loc.flags,
    )


def top_track_key(result: MatchResult) -> str | None:
    if not any(result.track_scores.values()):
        return None
    return max(result.track_scores, key=result.track_scores.get)


def rank_jobs(jobs: list, min_score: float = 0.5, top_n: int = 30) -> list:
    """Score, filter to location-eligible + above-threshold, dedupe by URL, rank desc."""
    results = [score_job(j) for j in jobs]
    seen_urls = set()
    eligible = []
    for r in results:
        url = r.job.get("url")
        if url in seen_urls:
            continue
        seen_urls.add(url)
        if r.location_eligible and r.score >= min_score:
            eligible.append(r)
    eligible.sort(key=lambda r: r.score, reverse=True)
    return eligible[:top_n]
