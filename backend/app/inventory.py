from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Label = Annotated[str, Field(max_length=260)]
Quantity = Annotated[int, Field(ge=0, le=2**53 - 1)]


class Section(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class MemoryModule(Section):
    slot: Label | None = None
    capacity: Quantity
    speed: Quantity | None = None
    type: Label | None = None


class Disk(Section):
    model: Label
    capacity: Quantity
    media: Label | None = None
    interface: Label | None = None


class Update(Section):
    title: Label
    kb: Label | None = None
    date: Label | None = None


class Inventory(Section):
    device: Label | None = None
    customer: Label | None = None
    os: Label | None = None
    release: Label | None = None
    revision: Quantity | None = None
    manufacturer: Label | None = None
    model: Label | None = None
    board: Label | None = None
    bios: Label | None = None
    firmware: Literal["Uefi", "Bios"] | None = None
    secure_boot: bool | None = None
    tpm: Label | None = None
    cpu: Label | None = None
    cores: Quantity | None = None
    clock_mhz: Quantity | None = None
    architecture: Literal["x64", "arm64", "other"] | None = None
    ram_installed: Quantity | None = None
    ram_slots: Quantity | None = None
    modules: Annotated[list[MemoryModule], Field(max_length=64)] = Field(default_factory=list)
    system_volume: Quantity | None = None
    system_disk: Quantity | None = None
    system_media: Label | None = None
    disks: Annotated[list[Disk], Field(max_length=64)] = Field(default_factory=list)
    graphics: Annotated[list[Label], Field(max_length=32)] = Field(default_factory=list)
    installed_updates: Annotated[list[Update], Field(max_length=10)] = Field(default_factory=list)
    pending_updates: Annotated[list[Update], Field(max_length=15)] = Field(default_factory=list)
    update_count: Quantity | None = None
    update_status: Literal["not_requested", "complete", "partial", "unavailable"] = "not_requested"
    reboot_required: bool | None = None
    uptime_minutes: Quantity | None = None
    cpu_load_percent: Annotated[int, Field(ge=0, le=100)] | None = None
    memory_free: Quantity | None = None
    unexpected_shutdowns: Quantity | None = None
    disk_health: Literal["healthy", "warning", "unhealthy"] | None = None
    defender_active: bool | None = None
    firewall_profiles_disabled: Quantity | None = None
    bitlocker_active: bool | None = None
    antivirus: Annotated[list[Label], Field(max_length=12)] | None = None
