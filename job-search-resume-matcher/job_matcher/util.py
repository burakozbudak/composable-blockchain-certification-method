from __future__ import annotations

import re

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def strip_html(html: str) -> str:
    if not html:
        return ""
    text = _TAG_RE.sub(" ", html)
    return _WS_RE.sub(" ", text).strip()


def make_job(*, title, company, location, description, url, source, tags=None, posted=None):
    return {
        "title": title or "",
        "company": company or "",
        "location": location or "",
        "description": strip_html(description or "")[:4000],
        "tags": ", ".join(tags) if isinstance(tags, (list, tuple)) else (tags or ""),
        "url": url or "",
        "source": source,
        "posted": posted or "",
    }
