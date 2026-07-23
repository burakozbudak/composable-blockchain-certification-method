from __future__ import annotations

import json
from datetime import datetime, timezone

from .matcher import MatchResult

TRACK_LABELS = {
    "software_frontend": "Frontend/Web",
    "software_general": "Software (general)",
    "blockchain": "Blockchain/Web3",
    "process_chemical_engineering": "Process/Chemical Eng.",
    "project_management": "Project Mgmt",
}

LOCATION_LABELS = {
    "turkey": "Turkey",
    "remote_global": "Remote (worldwide)",
    "abroad_onsite": "Abroad (on-site)",
    "unknown": "Location unclear",
}


def _top_track(result: MatchResult) -> str:
    if not any(result.track_scores.values()):
        return "-"
    best = max(result.track_scores, key=result.track_scores.get)
    return TRACK_LABELS.get(best, best)


def render_markdown(results: list, generated_at: datetime | None = None) -> str:
    generated_at = generated_at or datetime.now(timezone.utc)
    lines = [
        "# Job Matches for Burak Ozbudak",
        "",
        f"_Generated {generated_at.strftime('%Y-%m-%d %H:%M UTC')} - "
        f"{len(results)} matches (Turkey + remote/abroad, ranked by resume fit)_",
        "",
        "| # | Score | Title | Company | Location | Best-fit track | Source | Link |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(results, start=1):
        job = r.job
        loc_label = LOCATION_LABELS.get(r.location_category, r.location_category)
        lines.append(
            f"| {i} | {r.score:.2f} | {job['title']} | {job['company']} | "
            f"{job['location']} ({loc_label}) | {_top_track(r)} | {job['source']} | "
            f"[apply]({job['url']}) |"
        )

    lines.append("")
    lines.append("## Matched keywords per posting")
    lines.append("")
    for i, r in enumerate(results, start=1):
        flags = f" - ⚠ {', '.join(r.location_flags)}" if r.location_flags else ""
        lines.append(f"**{i}. {r.job['title']} @ {r.job['company']}**{flags}")
        lines.append(f"  {', '.join(r.matched_keywords) or '(no direct keyword hits)'}")
        lines.append("")

    return "\n".join(lines)


def render_html(results: list, generated_at: datetime | None = None) -> str:
    generated_at = generated_at or datetime.now(timezone.utc)
    payload = []
    for r in results:
        job = r.job
        payload.append({
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "location_category": r.location_category,
            "location_label": LOCATION_LABELS.get(r.location_category, r.location_category),
            "source": job["source"],
            "url": job["url"],
            "score": r.score,
            "top_track": _top_track(r),
            "matched_keywords": r.matched_keywords,
            "flags": r.location_flags,
            "description": job["description"][:600],
        })

    data_json = json.dumps(payload, ensure_ascii=False)
    track_options = "".join(f'<option value="{v}">{v}</option>' for v in sorted(TRACK_LABELS.values()))
    loc_options = "".join(f'<option value="{k}">{v}</option>' for k, v in LOCATION_LABELS.items())

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Job Matches - Burak Ozbudak</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {{ color-scheme: light dark; }}
  body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 2rem;
          background: #0b0d12; color: #e6e8ee; }}
  @media (prefers-color-scheme: light) {{ body {{ background: #f7f8fa; color: #1a1d24; }} }}
  h1 {{ font-size: 1.5rem; margin-bottom: 0.2rem; }}
  .meta {{ opacity: 0.7; margin-bottom: 1.5rem; font-size: 0.9rem; }}
  .controls {{ display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; }}
  select, input {{ background: transparent; color: inherit; border: 1px solid #8888; border-radius: 6px; padding: 0.4rem 0.6rem; }}
  .grid {{ display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }}
  .card {{ border: 1px solid #8886; border-radius: 10px; padding: 1rem; background: rgba(127,127,127,0.06); }}
  .card h3 {{ margin: 0 0 0.2rem 0; font-size: 1.05rem; }}
  .card .company {{ opacity: 0.8; margin-bottom: 0.5rem; }}
  .badge {{ display: inline-block; font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 999px;
            background: #3b82f622; border: 1px solid #3b82f666; margin-right: 0.3rem; margin-bottom: 0.3rem; }}
  .score {{ font-weight: 700; }}
  .desc {{ font-size: 0.85rem; opacity: 0.85; margin-top: 0.5rem; max-height: 4.5em; overflow: hidden; }}
  a.apply {{ display: inline-block; margin-top: 0.6rem; text-decoration: none; font-weight: 600; }}
  .warn {{ color: #e0a800; font-size: 0.8rem; }}
</style>
</head>
<body>
<h1>Job Matches for Burak Ozbudak</h1>
<div class="meta">Generated {generated_at.strftime('%Y-%m-%d %H:%M UTC')} - matches ranked against resume skill taxonomy, filtered to Turkey + remote/abroad.</div>
<div class="controls">
  <input id="q" placeholder="Filter by keyword..." oninput="render()">
  <select id="track" onchange="render()"><option value="">All tracks</option>{track_options}</select>
  <select id="loc" onchange="render()"><option value="">All locations</option>{loc_options}</select>
</div>
<div id="grid" class="grid"></div>
<script>
const DATA = {data_json};
function render() {{
  const q = document.getElementById('q').value.toLowerCase();
  const track = document.getElementById('track').value;
  const loc = document.getElementById('loc').value;
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  DATA.filter(j => {{
    if (track && j.top_track !== track) return false;
    if (loc && j.location_category !== loc) return false;
    if (q && !(j.title + j.company + j.description).toLowerCase().includes(q)) return false;
    return true;
  }}).forEach(j => {{
    const card = document.createElement('div');
    card.className = 'card';
    const flagHtml = j.flags.length ? `<div class="warn">Check eligibility: ${{j.flags.join(', ')}}</div>` : '';
    card.innerHTML = `
      <h3>${{j.title}}</h3>
      <div class="company">${{j.company}} - ${{j.location}}</div>
      <div><span class="badge score">score ${{j.score.toFixed(2)}}</span>
           <span class="badge">${{j.location_label}}</span>
           <span class="badge">${{j.top_track}}</span>
           <span class="badge">${{j.source}}</span></div>
      ${{flagHtml}}
      <div class="desc">${{j.description}}</div>
      <a class="apply" href="${{j.url}}" target="_blank" rel="noopener">View & apply -></a>
    `;
    grid.appendChild(card);
  }});
}}
render();
</script>
</body>
</html>"""
