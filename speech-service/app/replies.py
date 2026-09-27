"""Short spoken confirmations of what was saved, e.g. "Done. Tooth 11: marked as missing."

Built from the findings that were actually written to the database (not free LLM text),
so the assistant never confirms something that did not happen.
"""

SITES = ("mesial", "mid", "distal")

PHRASES = {
    "done": "Done.",
    "tooth": "Tooth {number}",
    "palatal": "Tooth {number}, palatal side",
    "lingual": "Tooth {number}, lingual side",
    "not_found": "I couldn't find tooth {number}.",
    "error": "Sorry, I couldn't process that.",
    "missing": {True: "marked as missing", False: "marked as present"},
    "implant": {True: "marked as implant", False: "implant removed"},
    "mobility": "mobility {value}",
    "furcation": "furcation {value}",
    "furcation_mesial": "mesial furcation {value}",
    "furcation_distal": "distal furcation {value}",
    "bleeding": "bleeding",
    "plaque": "plaque",
    "gingival_margin": "gingival margin",
    "probing_depth": "probing depth",
    "none": "no {name}",
}

SIMPLE_VALUE_FIELDS = ("mobility", "furcation", "furcation_mesial", "furcation_distal")
PER_SITE_FLAG_FIELDS = ("bleeding", "plaque")
PER_SITE_NUMBER_FIELDS = ("gingival_margin", "probing_depth")


def _tooth_label(number: str) -> str:
    if number.endswith("_L"):
        base = number[:-2]
        side = "palatal" if base[:1] in ("1", "2") else "lingual"  # upper teeth: palatal side
        return PHRASES[side].format(number=base)
    return PHRASES["tooth"].format(number=number)


def _describe(finding: dict) -> list[str]:
    parts = []
    for field in ("missing", "implant"):
        if field in finding:
            parts.append(PHRASES[field][bool(finding[field])])
    for field in SIMPLE_VALUE_FIELDS:
        if field in finding:
            parts.append(PHRASES[field].format(value=finding[field]))
    for field in PER_SITE_FLAG_FIELDS:
        sites = finding.get(field)
        if isinstance(sites, dict) and sites:
            positive = [s for s in SITES if sites.get(s) is True]
            parts.append(f"{PHRASES[field]} {', '.join(positive)}" if positive else PHRASES["none"].format(name=PHRASES[field]))
    for field in PER_SITE_NUMBER_FIELDS:
        values = finding.get(field)
        if isinstance(values, dict) and values:
            if all(s in values for s in SITES):
                parts.append(f"{PHRASES[field]} " + ", ".join(str(values[s]) for s in SITES))
            else:
                parts.append(f"{PHRASES[field]} " + ", ".join(f"{s} {values[s]}" for s in SITES if s in values))
    return parts


def build_reply(results: list[tuple[dict, bool]]) -> str:
    """Confirmation for the saved findings; empty string when nothing was charted."""
    saved, not_found = [], []
    for finding, was_saved in results:
        number = str(finding.get("teeth", ""))
        if not was_saved:
            not_found.append(PHRASES["not_found"].format(number=number.removesuffix("_L")))
            continue
        parts = _describe(finding)
        if parts:
            saved.append(f"{_tooth_label(number)}: {', '.join(parts)}.")

    if saved:
        return " ".join([PHRASES["done"], *saved, *not_found])
    return " ".join(not_found)


def error_reply() -> str:
    return PHRASES["error"]
