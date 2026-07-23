"""Classify a free-text job location string against Burak's target geography:
Turkey (home base) or abroad/remote (he is open to relocation and to
international remote work)."""

from __future__ import annotations

from dataclasses import dataclass

from .profile import REMOTE_TOKENS, RESTRICTIVE_TOKENS, TURKEY_TOKENS


@dataclass
class LocationVerdict:
    category: str  # "turkey" | "remote_global" | "abroad_onsite" | "unknown"
    eligible: bool
    flags: list


def classify_location(location_text: str) -> LocationVerdict:
    text = (location_text or "").strip().lower()
    flags = [tok for tok in RESTRICTIVE_TOKENS if tok in text]

    if not text:
        return LocationVerdict("unknown", True, flags)

    if any(tok in text for tok in TURKEY_TOKENS):
        return LocationVerdict("turkey", not flags, flags)

    if any(tok in text for tok in REMOTE_TOKENS):
        return LocationVerdict("remote_global", not flags, flags)

    # Anything else is treated as "abroad, on-site" — still eligible since the
    # brief explicitly wants opportunities located abroad, just excluded
    # when a restrictive eligibility token was also found.
    return LocationVerdict("abroad_onsite", not flags, flags)
