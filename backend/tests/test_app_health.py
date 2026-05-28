import asyncio

from app import health_check, root
from app.core.config import settings


def test_root_returns_metadata():
    result = asyncio.run(root())

    assert isinstance(result, dict)
    assert result["message"].startswith("Welcome to")
    assert "version" in result


def test_health_check_is_healthy():
    result = asyncio.run(health_check())

    assert result["status"] == "healthy"
    assert result["app"] == settings.APP_NAME
    assert "version" in result
