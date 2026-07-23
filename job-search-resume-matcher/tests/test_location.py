from job_matcher.location import classify_location


def test_turkey_city_is_turkey():
    v = classify_location("Ankara, Turkey")
    assert v.category == "turkey"
    assert v.eligible


def test_remote_worldwide_is_remote_global():
    v = classify_location("Remote - Worldwide")
    assert v.category == "remote_global"
    assert v.eligible


def test_abroad_onsite_is_eligible_by_default():
    v = classify_location("Ludwigshafen, Germany")
    assert v.category == "abroad_onsite"
    assert v.eligible


def test_restrictive_token_flags_but_does_not_silently_pass():
    v = classify_location("Remote (must be authorized to work in the US without sponsorship)")
    assert v.flags
    assert not v.eligible


def test_empty_location_is_unknown_but_included():
    v = classify_location("")
    assert v.category == "unknown"
    assert v.eligible
