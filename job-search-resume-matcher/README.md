# Job Search & Resume Matcher

A small, self-contained tool that pulls job postings from public job-board
APIs, scores each one against **Burak Ozbudak's** resume, and keeps only the
matches located in **Turkey** or **remote/abroad** that actually fit his
skill set — rather than a generic keyword search across every listing on
the internet.

Burak's profile is unusual: a practicing Chemical/Process Engineer
(Roketsan, Eti Soda/We Soda, Cimsa) finishing a Master's in Software
Engineering with hands-on React/JS and Solidity/smart-contract work. The
matcher's taxonomy (`job_matcher/profile.py`) reflects all four tracks —
process/chemical engineering, frontend/web, blockchain, and project
management — so a posting only needs to fit *one* of them well, not all.

## What it does

1. **Fetch** — pulls live postings from free, no-API-key job boards:
   [Remotive](https://remotive.com/api/remote-jobs),
   [Arbeitnow](https://www.arbeitnow.com/api/job-board-api),
   [Jobicy](https://jobicy.com/api/v2/remote-jobs), and
   [RemoteOK](https://remoteok.com/api). Any source that's down or
   rate-limited is skipped rather than failing the whole run.
2. **Score** — each posting's title/description/tags is matched against a
   weighted keyword taxonomy pulled straight from the resume (see
   `job_matcher/profile.py::SKILL_TRACKS`).
3. **Filter by location** — a posting is kept only if it's in Turkey, fully
   remote, or genuinely abroad (`job_matcher/location.py`). Postings that
   flag a hard eligibility restriction he doesn't meet (e.g. "must be
   authorized to work in the US without sponsorship") are excluded, with the
   flag preserved for transparency.
4. **Rank & report** — matches are deduped, sorted by score, and rendered to
   a Markdown table (`output/matches.md`) and a filterable, self-contained
   HTML dashboard (`output/matches.html`, opens directly in a browser, no
   server needed).
5. **Draft cover letters** — optionally drafts a templated cover letter per
   top match (`output/cover_letters/`), tailored to whichever skill track
   scored highest for that posting.

## What it deliberately does *not* do

**It does not submit applications automatically.** Most job boards'
Terms of Service prohibit automated form-filling/submission, many require a
login/CAPTCHA that a script shouldn't be solving, and a templated cover
letter still deserves a human read-through before it goes out under
someone's name. The tool's job is to turn "scan 200 listings across 5
sites" into "review 15 pre-scored, pre-drafted opportunities" — the actual
click-and-submit stays a deliberate human action.

## Turkey-market coverage

Kariyer.net, SecretCV, LinkedIn and Indeed Turkey don't expose a free public
JSON API, so they aren't wired into `job_matcher/aggregate.py`. The Turkey
coverage you get today comes from Remotive/Arbeitnow/Jobicy postings that
list a Turkish city, plus RemoteOK/Remotive remote roles open to Turkey. If
you want direct coverage of those sites, the cleanest legitimate options are
their official employer/partner APIs (if you get access) or a manual CSV
export dropped into `fixtures/` and merged in `aggregate.py`.

## Usage

```bash
cd job-search-resume-matcher
pip install -r requirements.txt

# Demo run against the bundled sample dataset — no network needed:
python main.py --offline --cover-letters 5

# Live run against the real APIs:
python main.py --live --min-score 0.5 --top 30 --cover-letters 10
```

Flags:

| Flag | Default | Meaning |
| --- | --- | --- |
| `--offline` | — | use `fixtures/sample_jobs.json` instead of live APIs |
| `--live` | on by default | fetch from Remotive/Arbeitnow/Jobicy/RemoteOK |
| `--min-score` | `0.5` | drop matches scoring below this |
| `--top` | `30` | max matches kept after ranking |
| `--cover-letters N` | `0` | draft cover letters for the top N matches |
| `--verbose` | off | log per-source fetch results (useful when a source fails) |

> **Note on this repo's CI/sandbox environment:** the sandbox this was
> built in blocks outbound requests to arbitrary hosts by policy, so
> `--live` can't be exercised from inside it — the run above used
> `--offline`. On a normal machine (or CI runner) with regular internet
> access, `--live` calls the same public APIs any browser can reach and
> works the same way.

## Updating the resume

If Burak's resume changes, update `job_matcher/profile.py`
(`Resume` dataclass + `SKILL_TRACKS` keyword lists) — that's the single
source of truth the matcher and cover-letter templates both read from.

## Running the tests

```bash
python -m pytest tests/ -q
```

Tests run entirely against `fixtures/sample_jobs.json`, so they need no
network access and are safe to run in CI.
