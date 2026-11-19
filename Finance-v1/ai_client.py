"""One provider and one model for all optional explanations."""
import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# Keys come only from the environment. A .env in Finance-v1 wins over one in the
# repository root; neither overrides variables that are already set.
HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
load_dotenv(HERE.parent / ".env")


def configured():
    value = os.getenv("OPENROUTER_API_KEY", "").strip()
    return bool(value and value not in ["your_openrouter_key_here", "demo-disabled", "paste-your-key-here"])


def content_text(content):
    """Only public text blocks belong in the browser response."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(block if isinstance(block, str) else block.get("text", "")
                         for block in content if isinstance(block, str) or
                         (isinstance(block, dict) and block.get("type") == "text"))
    return ""


@lru_cache(maxsize=1)
def get_model():
    return ChatOpenAI(model=os.getenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini"),
                      temperature=.2, timeout=150, max_retries=0,
                      base_url="https://openrouter.ai/api/v1",
                      api_key=os.getenv("OPENROUTER_API_KEY") or "demo-disabled",
                      default_headers={"HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:5173"),
                                       "X-Title": os.getenv("OPENROUTER_SITE_NAME", "AlphaSharp")})
