from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.schemas.result import AnalyzeAcceptedResponse, AnalyzeRequest, AnalysisResult

router = APIRouter(prefix="/api/v1/analyze", tags=["analyze"])


@router.post("", status_code=202, response_model=AnalyzeAcceptedResponse)
async def submit_analysis(payload: AnalyzeRequest, request: Request) -> AnalyzeAcceptedResponse:
    orchestrator = request.app.state.orchestrator
    analysis_id, _cache_hit = await orchestrator.submit(payload.text)
    return AnalyzeAcceptedResponse(analysis_id=analysis_id)


@router.get("/{analysis_id}/stream")
async def stream_analysis(analysis_id: UUID, request: Request) -> EventSourceResponse:
    orchestrator = request.app.state.orchestrator

    async def event_generator():
        async for event_type, payload in orchestrator.stream(analysis_id):
            yield {"event": event_type, "data": json.dumps(payload, default=str)}

    return EventSourceResponse(event_generator())


@router.get("/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: UUID, request: Request) -> AnalysisResult:
    orchestrator = request.app.state.orchestrator
    result = await orchestrator.get_result(analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Analysis not found or not yet completed.")
    return result
