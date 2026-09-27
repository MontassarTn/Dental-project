"""Dictation memory, one per patient: what was said and what the assistant answered.

Kept across recordings (stop / start), so a sentence can be finished later -
"Tooth 12 and 13" ... "are missing" - and the LLM still knows which teeth are meant.
Held in this service's memory: it is lost when the service restarts.
"""
from collections import deque
from dataclasses import dataclass

MAX_TURNS = 12  # older sentences are forgotten


@dataclass
class Turn:
    said: str       # the transcript
    extracted: str  # JSON lines the LLM extracted ("" = nothing to chart)
    reply: str      # what the assistant answered ("" = no chart change)


_turns: dict[str, deque[Turn]] = {}


def remember(patient_id: str, turn: Turn) -> None:
    _turns.setdefault(patient_id, deque(maxlen=MAX_TURNS)).append(turn)


def turns(patient_id: str) -> list[Turn]:
    return list(_turns.get(patient_id, ()))


def forget(patient_id: str) -> None:
    _turns.pop(patient_id, None)


def chat_history(patient_id: str) -> str:
    """The conversation in the "Human: ... / AI: ..." form the rephrase prompts expect."""
    return "\n".join(f"Human: {t.said}\nAI: {t.extracted}" for t in turns(patient_id))
