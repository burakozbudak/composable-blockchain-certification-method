#!/usr/bin/env python3
"""Job Search & Resume Matcher - entrypoint.

    python main.py --offline                 # demo run against bundled sample data
    python main.py --live                     # hit Remotive/Arbeitnow/Jobicy/RemoteOK
    python main.py --live --min-score 1.0 --top 20 --cover-letters 5
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from job_matcher.aggregate import fetch_all, load_offline_fixture  # noqa: E402
from job_matcher.cover_letter import draft_cover_letter  # noqa: E402
from job_matcher.matcher import rank_jobs, top_track_key  # noqa: E402
from job_matcher.report import render_html, render_markdown  # noqa: E402

OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--offline", action="store_true", help="use the bundled sample dataset (no network)")
    mode.add_argument("--live", action="store_true", help="fetch live postings from public job-board APIs")
    parser.add_argument("--min-score", type=float, default=0.5, help="minimum match score to keep (default: 0.5)")
    parser.add_argument("--top", type=int, default=30, help="max number of ranked matches to keep (default: 30)")
    parser.add_argument("--cover-letters", type=int, default=0, help="draft cover letters for the top N matches")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING,
                         format="%(levelname)s %(name)s: %(message)s")

    live = args.live or not args.offline
    jobs = fetch_all() if live else load_offline_fixture()
    if not jobs:
        print("No postings fetched (all sources failed or returned nothing). "
              "Falling back to --offline sample data.", file=sys.stderr)
        jobs = load_offline_fixture()

    results = rank_jobs(jobs, min_score=args.min_score, top_n=args.top)

    OUTPUT_DIR.mkdir(exist_ok=True)
    md_path = OUTPUT_DIR / "matches.md"
    html_path = OUTPUT_DIR / "matches.html"
    md_path.write_text(render_markdown(results))
    html_path.write_text(render_html(results))

    print(f"{len(jobs)} postings scanned -> {len(results)} matches kept "
          f"(Turkey + remote/abroad, score >= {args.min_score}).")
    print(f"Markdown report: {md_path}")
    print(f"HTML dashboard:  {html_path}")

    if args.cover_letters:
        letters_dir = OUTPUT_DIR / "cover_letters"
        letters_dir.mkdir(exist_ok=True)
        for i, r in enumerate(results[: args.cover_letters], start=1):
            track = top_track_key(r) or "process_chemical_engineering"
            letter = draft_cover_letter(r.job, track)
            safe_company = "".join(c for c in r.job["company"] if c.isalnum() or c in " -_")[:40].strip() or "company"
            path = letters_dir / f"{i:02d}_{safe_company.replace(' ', '_')}.txt"
            path.write_text(letter)
        print(f"Drafted {min(args.cover_letters, len(results))} cover letters in {letters_dir}")


if __name__ == "__main__":
    main()
