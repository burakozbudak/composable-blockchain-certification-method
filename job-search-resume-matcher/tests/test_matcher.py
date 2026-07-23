import json
from pathlib import Path

from job_matcher.matcher import rank_jobs, score_job, top_track_key

FIXTURE = json.loads(
    (Path(__file__).resolve().parent.parent / "fixtures" / "sample_jobs.json").read_text()
)


def _find(title_substr):
    return next(j for j in FIXTURE if title_substr.lower() in j["title"].lower())


def test_react_job_scores_highest_on_frontend_track():
    job = _find("React Frontend Developer")
    result = score_job(job)
    assert result.score > 0
    assert top_track_key(result) == "software_frontend"
    assert "react" in result.matched_keywords


def test_solidity_job_scores_on_blockchain_track():
    job = _find("Smart Contract / Solidity")
    result = score_job(job)
    assert top_track_key(result) == "blockchain"
    assert "solidity" in result.matched_keywords


def test_process_engineer_job_scores_on_chemical_track():
    job = _find("Process Engineer - Energy")
    result = score_job(job)
    assert top_track_key(result) == "process_chemical_engineering"


def test_marketing_job_scores_near_zero():
    job = _find("Marketing Manager")
    result = score_job(job)
    assert result.score == 0


def test_rank_jobs_excludes_low_score_and_ineligible_location():
    ranked = rank_jobs(FIXTURE, min_score=0.5, top_n=30)
    titles = [r.job["title"] for r in ranked]
    assert "Marketing Manager" not in titles
    # US-citizens-only remote job should be excluded despite topical relevance
    assert not any("USChain" in r.job["company"] for r in ranked)


def test_rank_jobs_sorted_descending_by_score():
    ranked = rank_jobs(FIXTURE, min_score=0.0, top_n=30)
    scores = [r.score for r in ranked]
    assert scores == sorted(scores, reverse=True)


def test_rank_jobs_dedupes_by_url():
    dup = FIXTURE + [FIXTURE[0]]
    ranked = rank_jobs(dup, min_score=0.0, top_n=100)
    urls = [r.job["url"] for r in ranked]
    assert len(urls) == len(set(urls))
