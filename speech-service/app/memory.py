"""Dictation memory, one per patient: what was said and what the assistant answered.

Kept across recordings (stop / start), so a sentence can be finished later -
"Tooth 12 and 13" ... "are missing" - and the LLM still knows which teeth are meant.
Stored in MongoDB (collection "dictations"), so it survives restarts and redeploys of this
service. Blocking calls: run them in a thread from async code.
"""
from dataclasses import dataclass
from datetime import datetime, timezone

from pymongo import ASCENDING, DESCENDING

from app.database import db

MAX_TURNS = 12  # only the latest sentences are used as LLM context and shown on screen

_dictations = db["dictations"]
_NEWEST_FIRST = [("createdAt", DESCENDING), ("_id", DESCENDING)]


@dataclass
class Turn:
    said: str       # the transcript
    extracted: str  # JSON lines the LLM extracted ("" = nothing to chart)
    reply: str      # what the assistant answered ("" = no chart change)


def create_indexes() -> None:
    _dictations.create_index([("patientId", ASCENDING), ("createdAt", DESCENDING)])


def remember(patient_id: str, turn: Turn) -> None:
    _dictations.insert_one({
        "patientId": patient_id,
        "said": turn.said,
        "extracted": turn.extracted,
        "reply": turn.reply,
        "createdAt": datetime.now(timezone.utc),
    })


def turns(patient_id: str) -> list[Turn]:
    """The latest MAX_TURNS sentences for this patient, oldest first."""
    newest = _dictations.find({"patientId": patient_id}).sort(_NEWEST_FIRST).limit(MAX_TURNS)
    return [Turn(d["said"], d["extracted"], d["reply"]) for d in reversed(list(newest))]


def forget(patient_id: str) -> None:
    _dictations.delete_many({"patientId": patient_id})


def chat_history(patient_id: str) -> str:
    """The conversation in the "Human: ... / AI: ..." form the rephrase prompt expects."""
    return "\n".join(f"Human: {t.said}\nAI: {t.extracted}" for t in turns(patient_id))
