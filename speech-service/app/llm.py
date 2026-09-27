"""Turns a finished transcript into tooth updates with a Groq-hosted LLM.

Each transcript goes through two LLM calls:
1. Rephrase - clean up the spoken sentence, using the patient's conversation so far
   (see memory.py), e.g. "are missing" after "tooth 12 and 13" -> "Teeth 12 and 13 are missing."
2. Extract  - turn that sentence into one JSON object per tooth, then save each to MongoDB.
"""
import asyncio
import json
import logging

from groq import AsyncGroq

from app.config import GROQ_API_KEY, GROQ_MODEL
from app.prompts import EXTRACT_PROMPT, REPHRASE_PROMPT
from app.teeth_repository import update_tooth

log = logging.getLogger(__name__)

_client = AsyncGroq(api_key=GROQ_API_KEY)


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
    results = []
    for finding in parse_json_lines(extracted):
        if "teeth" not in finding:
            continue
        finding["teeth"] = str(finding["teeth"])
        saved = await asyncio.to_thread(update_tooth, {**finding, "patientId": patient_id})
        results.append((finding, saved))
    return extracted, results
