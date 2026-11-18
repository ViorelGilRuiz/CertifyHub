from threading import Lock
from time import monotonic
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from . import storage
from .models import Diagnostic

router = APIRouter(prefix="/analysis")
mutex = Lock()
ACTIVE = {"connecting", "collecting", "evaluating", "generating"}
LEASE_SECONDS = 180
HEARTBEAT_SECONDS = 18
job: dict | None = None
last_seen: float | None = None
device: str | None = None


def local_request(x_certifyhub_local: Literal["1"] = Header()):
    """Require a custom header on local control requests."""


class Agent(BaseModel):
    device: str = Field(min_length=1, max_length=63)


class Progress(BaseModel):
    stage: Literal["evaluating", "generating", "failed"]


def expire(now: float):
    if job and job["stage"] in ACTIVE and now >= job["deadline"]:
        job["stage"] = "failed"


def snapshot(now: float):
    return {
        "agent": {"online": last_seen is not None and now - last_seen < HEARTBEAT_SECONDS, "device": device},
        "job": {"id": job["id"], "stage": job["stage"]} if job else None,
    }


@router.get("")
def analysis_status():
    with mutex:
        now = monotonic()
        expire(now)
        return snapshot(now)


@router.post("", dependencies=[Depends(local_request)])
def start():
    global job
    with mutex:
        now = monotonic()
        expire(now)
        if job and job["stage"] in ACTIVE:
            return snapshot(now)
        if last_seen is None or now - last_seen >= HEARTBEAT_SECONDS:
            raise HTTPException(409, "El agente local está desconectado.")
        job = {"id": uuid4().hex, "stage": "connecting", "deadline": now + HEARTBEAT_SECONDS}
        return snapshot(now)


@router.post("/claim", dependencies=[Depends(local_request)])
def claim(agent: Agent):
    global last_seen, device
    with mutex:
        now = monotonic()
        last_seen, device = now, agent.device
        expire(now)
        if job and job["stage"] == "connecting":
            job.update(stage="collecting", deadline=now + LEASE_SECONDS, lease=uuid4().hex)
            return {"id": job["id"], "lease": job["lease"]}
        return None


def validate_job(job_id: str, lease: str, now: float):
    expire(now)
    if not job or job["id"] != job_id or job.get("lease") != lease or job["stage"] not in ACTIVE:
        raise HTTPException(409, "El análisis ya no está activo.")
    return job


@router.post("/{job_id}/progress", dependencies=[Depends(local_request)])
def progress(job_id: str, update: Progress, x_certifyhub_lease: str = Header()):
    global last_seen
    with mutex:
        now = monotonic()
        active = validate_job(job_id, x_certifyhub_lease, now)
        expected = {"collecting": "evaluating", "evaluating": "generating"}.get(active["stage"])
        if update.stage != "failed" and expected != update.stage:
            raise HTTPException(409, "La etapa de análisis no es válida.")
        active.update(stage=update.stage, deadline=now + LEASE_SECONDS)
        last_seen = now
    return {"stage": update.stage}


@router.post("/{job_id}/report", dependencies=[Depends(local_request)])
def finish(job_id: str, report: Diagnostic, x_certifyhub_lease: str = Header()):
    global last_seen
    with mutex:
        now = monotonic()
        active = validate_job(job_id, x_certifyhub_lease, now)
        if active["stage"] != "generating":
            raise HTTPException(409, "El informe aún no está listo.")
        result = storage.save(report)
        active["stage"] = "completed"
        last_seen = now
        return {"id": result["id"], "stage": active["stage"]}
