from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Mode
    mock_mode: bool = Field(default=True, alias="MOCK_MODE")

    # Groq
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    groq_temperature: float = Field(default=0.0, alias="GROQ_TEMPERATURE")

    # Database
    database_url: str = Field(
        default="postgresql+asyncpg://veritas:veritas_dev_password@localhost:5432/veritas",
        alias="DATABASE_URL",
    )

    # Embeddings
    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2", alias="EMBEDDING_MODEL"
    )
    embedding_device: str = Field(default="cpu", alias="EMBEDDING_DEVICE")

    # Web search
    web_search_provider: Literal["duckduckgo", "mock"] = Field(
        default="duckduckgo", alias="WEB_SEARCH_PROVIDER"
    )
    web_search_max_results: int = Field(default=5, alias="WEB_SEARCH_MAX_RESULTS")

    # Retrieval
    retrieval_top_k_corpus: int = Field(default=6, alias="RETRIEVAL_TOP_K_CORPUS")
    retrieval_top_k_web: int = Field(default=5, alias="RETRIEVAL_TOP_K_WEB")
    retrieval_dedup_similarity_threshold: float = Field(
        default=0.95, alias="RETRIEVAL_DEDUP_SIMILARITY_THRESHOLD"
    )

    # Graph execution
    node_timeout_seconds: int = Field(default=30, alias="NODE_TIMEOUT_SECONDS")
    groq_max_retries: int = Field(default=3, alias="GROQ_MAX_RETRIES")
    groq_backoff_base_seconds: float = Field(default=1.0, alias="GROQ_BACKOFF_BASE_SECONDS")
    stance_schema_repair_max_retries: int = Field(
        default=2, alias="STANCE_SCHEMA_REPAIR_MAX_RETRIES"
    )

    # Cache
    prompt_version: str = Field(default="v1", alias="PROMPT_VERSION")

    # Auth
    # >= 32 bytes so HS256 doesn't warn (RFC 7518); still a dev-only default.
    auth_secret_key: str = Field(
        default="dev-secret-change-me-before-any-deploy", alias="AUTH_SECRET_KEY"
    )
    auth_token_ttl_seconds: int = Field(default=604_800, alias="AUTH_TOKEN_TTL_SECONDS")
    auth_cookie_secure: bool = Field(default=False, alias="AUTH_COOKIE_SECURE")

    # App
    app_env: str = Field(default="development", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
