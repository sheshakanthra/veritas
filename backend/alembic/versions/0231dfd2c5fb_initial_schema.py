"""initial schema - corpus_documents, analysis_records

Revision ID: 0231dfd2c5fb
Revises:
Create Date: 2026-07-09
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0231dfd2c5fb"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None

EMBEDDING_DIM = 384


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "corpus_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("url", sa.String(length=2048), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_corpus_documents_domain", "corpus_documents", ["domain"])
    op.execute(
        "CREATE INDEX ix_corpus_documents_embedding ON corpus_documents "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.create_table(
        "analysis_records",
        sa.Column("analysis_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("result_json", postgresql.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_analysis_records_cache_key", "analysis_records", ["cache_key"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_analysis_records_cache_key", table_name="analysis_records")
    op.drop_table("analysis_records")
    op.drop_index("ix_corpus_documents_embedding", table_name="corpus_documents")
    op.drop_index("ix_corpus_documents_domain", table_name="corpus_documents")
    op.drop_table("corpus_documents")
