"""Settings, read from environment variables or the .env file (see .env.example)."""
import os

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable {name} - add it to .env (see .env.example)")
    return value


ASSEMBLYAI_API_KEY = _require("ASSEMBLYAI_API_KEY")
GROQ_API_KEY = _require("GROQ_API_KEY")
MONGODB_URI = _require("MONGODB_URI")

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
