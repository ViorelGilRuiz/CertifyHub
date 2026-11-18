[CmdletBinding()]
param(
    [switch]$Enviar,
    [ValidateRange(1, 65535)]
    [int]$PuertoApi = 8000
)

$ErrorActionPreference = 'Stop'
$os = Get-CimInstance -ClassName Win32_OperatingSystem -Property BuildNumber, SystemDrive, TotalVisibleMemorySize
$computer = Get-CimInstance -ClassName Win32_ComputerSystem -Property NumberOfLogicalProcessors
$disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$($os.SystemDrive)'" -Property FreeSpace
if ($null -eq $disk.FreeSpace -or $null -eq $os.TotalVisibleMemorySize) {
    throw 'No se pudieron leer las métricas del equipo.'
}

$report = [ordered]@{
    windows_build = [string]$os.BuildNumber
    logical_processors = [int]$computer.NumberOfLogicalProcessors
    memory_bytes = [long]($os.TotalVisibleMemorySize * 1KB)
    system_disk_free_bytes = [long]$disk.FreeSpace
}
$json = $report | ConvertTo-Json -Compress

if ($Enviar) {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:${PuertoApi}/diagnostics" -ContentType 'application/json' -Body $json -TimeoutSec 10
} else {
    $json
}
