"""Bump PROMPT_VERSION whenever any prompt template's wording changes in a
way that could change model output - it's part of the cache key
(sha256(normalized_text + model_id + PROMPT_VERSION)), so a prompt edit
correctly invalidates previously cached results instead of silently
serving stale verdicts under the new wording.
"""

PROMPT_VERSION = "v1"
