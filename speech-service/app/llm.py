"""Turns a finished transcript into tooth updates with a Groq-hosted LLM.

Each transcript goes through two LLM calls:
1. Rephrase - clean up the spoken sentence, using the patient's conversation so far
   (see memory.py), e.g. "are missing" after "tooth 12 and 13" -> "Teeth 12 and 13 are missing."
2. Extract  - turn that sentence into one JSON object per tooth, then save each to MongoDB.
"""
import asyncio
import json
import logging
import re

from groq import AsyncGroq

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.prompts import EXTRACT_PROMPT, REPHRASE_PROMPT
from app.teeth_repository import update_tooth

log = logging.getLogger(__name__)

_client = AsyncGroq(api_key=GROQ_API_KEY)

SITES = ("mesial", "mid", "distal")
PER_SITE_FIELDS = ("bleeding", "plaque", "gingival_margin", "probing_depth")


async def _complete(prompt: str) -> str:
    completion = await _client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.6,
        reasoning_effort="low",  # short structured task: keep latency low for live dictation
        max_completion_tokens=2048,  # includes the model's reasoning tokens
    )
    return (completion.choices[0].message.content or "").strip()


def parse_json_lines(text: str) -> list[dict]:
    findings = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            findings.append(json.loads(line))
        except json.JSONDecodeError:
            log.warning("Skipping invalid JSON line from LLM: %s", line)
    return findings


def mentions_site(text: str) -> bool:
    """Whether a site was spoken: mesial / mid / distal, or front / middle / center / back."""
    words = re.findall(r"[a-z]+", text.lower())
    return any(w.startswith(("mesial", "distal")) or w in ("mid", "middle", "center", "centre", "front", "back")
               for w in words)


def expand_sites(finding: dict, site_said: bool) -> dict:
    """A per-site finding given without a site ("tooth 47 has plaque", "gingival margin 1")
    applies to all three sites; the spoken reply then says so. A single site is kept only
    when one was actually spoken - the LLM sometimes carries one over from an earlier sentence."""
    for field in PER_SITE_FIELDS:
        value = finding.get(field)
        if (isinstance(value, dict) and not site_said and 0 < len(value) < len(SITES)
                and len(set(value.values())) == 1):
            value = next(iter(value.values()))
        if isinstance(value, (bool, int, float)):
            finding[field] = {site: value for site in SITES}
    return finding


async def process_transcript(
    transcript: str, chat_history: str, patient_id: str | None
) -> tuple[str, list[tuple[dict, bool]]]:
    """Rephrase, extract and save the findings in one transcript.

    Returns the extracted JSON lines, and each finding with whether it was saved
    (False = no such tooth for this patient).
    """
    sentence = await _complete(REPHRASE_PROMPT.format(chat_history=chat_history, question=transcript))
    extracted = await _complete(EXTRACT_PROMPT.format(question=sentence)) if sentence else ""

    log.info("LLM findings: %s", extracted or "(nothing to chart)")
    site_said = mentions_site(transcript)
    results = []
    for finding in parse_json_lines(extracted):
        if "teeth" not in finding:
            continue
        finding["teeth"] = str(finding["teeth"])
        expand_sites(finding, site_said)
        saved = await asyncio.to_thread(update_tooth, {**finding, "patientId": patient_id})
        results.append((finding, saved))
    return extracted, results
