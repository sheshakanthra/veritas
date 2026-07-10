from __future__ import annotations

import json

import httpx
import pytest
from httpx import ASGITransport

from app.main import create_app

SUBSTANTIAL_CLAIM = (
    "The city council approved a $42 million budget for the new transit "
    "line after a unanimous vote on Tuesday evening."
)


@pytest.fixture
async def client():
    app = create_app()
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


class TestAnalyzeEndpoint:
    async def test_submit_returns_202_with_analysis_id(self, client):
        response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        assert response.status_code == 202
        assert "analysis_id" in response.json()

    async def test_stream_emits_node_events_then_result(self, client):
        submit_response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        analysis_id = submit_response.json()["analysis_id"]

        async with client.stream("GET", f"/api/v1/analyze/{analysis_id}/stream") as response:
            events = []
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    events.append(line.split(":", 1)[1].strip())

        assert events.count("node") == 6
        assert events[-1] == "result"

    async def test_repeat_submission_reuses_analysis_id_and_is_cache_hit(self, client):
        first = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        first_id = first.json()["analysis_id"]

        async with client.stream("GET", f"/api/v1/analyze/{first_id}/stream") as response:
            async for _ in response.aiter_lines():
                pass

        second = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        assert second.json()["analysis_id"] == first_id

        async with client.stream("GET", f"/api/v1/analyze/{first_id}/stream") as response:
            lines = [line async for line in response.aiter_lines()]

        data_lines = [line for line in lines if line.startswith("data:")]
        result_payload = json.loads(data_lines[-1].split(":", 1)[1].strip())
        assert result_payload["cache_hit"] is True

    async def test_get_completed_analysis_returns_full_result(self, client):
        submit_response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        analysis_id = submit_response.json()["analysis_id"]

        async with client.stream("GET", f"/api/v1/analyze/{analysis_id}/stream") as response:
            async for _ in response.aiter_lines():
                pass

        get_response = await client.get(f"/api/v1/analyze/{analysis_id}")
        assert get_response.status_code == 200
        body = get_response.json()
        assert body["analysis_id"] == analysis_id
        assert body["overall_verdict"] in {"SUPPORTED", "REFUTED", "MISLEADING_CONTEXT", "UNVERIFIABLE"}

    async def test_stored_result_accumulates_trace_from_every_node(self, client):
        # Regression test: astream(stream_mode="updates") yields each
        # node's raw, unreduced diff - orchestrator._run_and_stream must
        # manually accumulate `trace` (see the operator.add comment there)
        # or only the last node's single event survives into storage.
        submit_response = await client.post("/api/v1/analyze", json={"text": SUBSTANTIAL_CLAIM})
        analysis_id = submit_response.json()["analysis_id"]

        async with client.stream("GET", f"/api/v1/analyze/{analysis_id}/stream") as response:
            async for _ in response.aiter_lines():
                pass

        get_response = await client.get(f"/api/v1/analyze/{analysis_id}")
        trace_nodes = [event["node"] for event in get_response.json()["trace"]]
        assert trace_nodes == ["ingest", "decompose", "retrieve", "stance", "adjudicate", "synthesize"]

    async def test_get_unknown_analysis_is_404(self, client):
        response = await client.get("/api/v1/analyze/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404

    async def test_short_input_is_rejected_and_streams_error(self, client):
        submit_response = await client.post("/api/v1/analyze", json={"text": "Too short."})
        analysis_id = submit_response.json()["analysis_id"]

        async with client.stream("GET", f"/api/v1/analyze/{analysis_id}/stream") as response:
            events = []
            async for line in response.aiter_lines():
                if line.startswith("event:"):
                    events.append(line.split(":", 1)[1].strip())

        assert "error" in events


class TestHealthEndpoint:
    async def test_health_reports_ok_in_mock_mode(self, client):
        response = await client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert {d["name"] for d in body["dependencies"]} == {"db", "groq", "embedder"}

    async def test_calibration_report_has_bins(self, client):
        response = await client.get("/health/calibration")
        assert response.status_code == 200
        body = response.json()
        assert len(body["bins"]) == 5
        assert body["total_samples"] > 0
