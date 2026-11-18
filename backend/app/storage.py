import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .models import Diagnostic


def initialize():
    with psycopg.connect() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS diagnostics (
                id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                received_at timestamptz NOT NULL DEFAULT now(),
                metrics jsonb NOT NULL
            )
        """)


def save(report: Diagnostic):
    with psycopg.connect(row_factory=dict_row) as connection:
        return connection.execute(
            "INSERT INTO diagnostics (metrics) VALUES (%s) RETURNING id, received_at, metrics",
            (Jsonb(report.model_dump()),),
        ).fetchone()


def latest():
    with psycopg.connect(row_factory=dict_row) as connection:
        return connection.execute(
            "SELECT id, received_at, metrics FROM diagnostics ORDER BY id DESC LIMIT 1"
        ).fetchone()
