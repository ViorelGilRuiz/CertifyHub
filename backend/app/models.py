from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from .inventory import Inventory

NonNegative = Annotated[int, Field(ge=0, le=2**63 - 1)]


class Diagnostic(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    windows_build: Annotated[str, Field(pattern=r"^[0-9]{1,10}$")]
    logical_processors: Annotated[int, Field(gt=0, le=65535)]
    memory_bytes: NonNegative
    system_disk_free_bytes: NonNegative
    inventory: Inventory | None = None
