"""Global test configuration.

MOCK_MODE=true is enforced for the whole suite, and outbound network
connections are blocked for every test via pytest-socket's connect()
guard. This is the mechanical proof behind "MOCK_MODE=true pytest passes
with zero network calls" - if any code path tries to connect() to a host
outside the loopback allowlist, the test fails loudly instead of silently
hitting the network.

We deliberately use `socket_allow_hosts` alone rather than
`disable_socket()`: the latter blocks `socket.socket()` construction
outright, which also breaks asyncio's own Windows ProactorEventLoop (it
opens a loopback socketpair for its internal wakeup pipe). Restricting
`connect()` to loopback gives the same "no external network" guarantee
without breaking the event loop itself.
"""
from __future__ import annotations

import os

import pytest
from pytest_socket import socket_allow_hosts

os.environ["MOCK_MODE"] = "true"


@pytest.fixture(autouse=True)
def _block_external_sockets():
    socket_allow_hosts(["127.0.0.1", "localhost", "::1"], allow_unix_socket=True)
    yield


@pytest.fixture(autouse=True)
def _reset_sse_starlette_app_status():
    """sse_starlette caches a module-level asyncio.Event the first time any
    SSE response runs, bound to whatever event loop was current then.
    pytest-asyncio gives each test function a fresh loop, so without this
    reset the second SSE test in a session fails with 'Event object is
    bound to a different event loop'."""
    from sse_starlette.sse import AppStatus

    AppStatus.should_exit = False
    AppStatus.should_exit_event = None
    yield
