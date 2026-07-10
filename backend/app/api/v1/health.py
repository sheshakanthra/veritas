from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request

from app.graph.nodes.calibration import build_calibration_report
from app.schemas.result import CalibrationReport, DependencyHealth, HealthResponse

router = APIRouter(tags=["health"])

_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "tests" / "fixtures" / "labelled_claims.json"
)


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    deps: list[DependencyHealth] = []

    if settings.mock_mode:
        deps.append(DependencyHealth(name="db", status="ok", detail="MOCK_MODE - in-memory repository"))
        deps.append(DependencyHealth(name="groq", status="ok", detail="MOCK_MODE - MockLLMProvider"))
        deps.append(DependencyHealth(name="embedder", status="ok", detail="MOCK_MODE - MockEmbeddingProvider"))
    else:
        deps.append(await _check_db(request))
        deps.append(_check_groq(settings))
        deps.append(DependencyHealth(name="embedder", status="ok"))

    overall = "ok" if all(d.status == "ok" for d in deps) else "degraded"
    return HealthResponse(status=overall, dependencies=deps)


async def _check_db(request: Request) -> DependencyHealth:
    try:
        from sqlalchemy import text

        from app.db.session import get_engine

        async with get_engine().connect() as conn:
            await conn.execute(text("SELECT 1"))
        return DependencyHealth(name="db", status="ok")
    except Exception as exc:  # noqa: BLE001
        return DependencyHealth(name="db", status="down", detail=str(exc))


def _check_groq(settings) -> DependencyHealth:
    if not settings.groq_api_key:
        return DependencyHealth(name="groq", status="degraded", detail="GROQ_API_KEY not set")
    return DependencyHealth(name="groq", status="ok")


@router.get("/health/calibration", response_model=CalibrationReport)
async def calibration_health() -> CalibrationReport:
    examples = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    return build_calibration_report(examples)
