"""Writes dictated findings to the teeth collection in MongoDB.

The backend watches this collection and pushes every change to the chart in the browser.
"""
import logging

from app.database import db

log = logging.getLogger(__name__)

_teeth = db["tooths"]

# LLM field names -> field names used in the database
FIELD_NAME_MAP = {
    "gingival_margin": "gingivalMargin",
    "probing_depth": "probingDepth",
}


def _normalize_keys(data: dict) -> dict:
    return {
        FIELD_NAME_MAP.get(key, key): _normalize_keys(value) if isinstance(value, dict) else value
        for key, value in data.items()
    }


def update_tooth(finding: dict) -> bool:
    """Apply one finding, e.g. {"patientId": "PAT001", "teeth": "16", "probing_depth": {"mid": 3}}.

    Nested values are merged, so {"mid": 3} leaves mesial/distal untouched.
    Returns False if the patient has no such tooth.
    """
    data = _normalize_keys(finding)
    patient_id = data.pop("patientId", None)
    tooth_number = str(data.pop("teeth", None))

    existing = _teeth.find_one({"patientId": patient_id, "number": tooth_number})
    if not existing:
        log.warning("No tooth %s found for patient %s", tooth_number, patient_id)
        return False

    changes = {}
    for key, value in data.items():
        if isinstance(value, dict) and isinstance(existing.get(key), dict):
            for sub_key, sub_value in value.items():
                changes[f"{key}.{sub_key}"] = sub_value
        else:
            changes[key] = value

    if not changes:
        log.info("Nothing to update for tooth %s", tooth_number)
        return True

    result = _teeth.update_one({"patientId": patient_id, "number": tooth_number}, {"$set": changes})
    log.info("Tooth %s of patient %s updated (%d modified): %s", tooth_number, patient_id, result.modified_count, changes)
    return True
