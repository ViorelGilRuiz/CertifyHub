from contextlib import asynccontextmanager
from datetime import datetime

import psycopg
from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from . import storage
from .models import Diagnostic


class Report(BaseModel):
    id: int
    received_at: datetime
    metrics: Diagnostic


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_in_threadpool(storage.initialize)
    yield


app = FastAPI(title="CertifyHub", lifespan=lifespan)


@app.exception_handler(psycopg.OperationalError)
async def unavailable(request: Request, error: psycopg.OperationalError):
    return JSONResponse(status_code=503, content={"detail": "Base de datos no disponible"})


@app.get("/health")
def health():
    storage.latest()
    return {"status": "ok"}


@app.post("/diagnostics", status_code=201)
def create_diagnostic(report: Diagnostic) -> Report:
    return storage.save(report)


@app.get("/diagnostics/latest")
def latest_diagnostic() -> Report | None:
    return storage.latest()
