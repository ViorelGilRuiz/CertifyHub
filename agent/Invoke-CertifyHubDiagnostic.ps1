[CmdletBinding()]
param(
    [switch]$Enviar,
    [ValidateRange(1, 65535)]
    [int]$PuertoApi = 8000,
    [switch]$BuscarActualizaciones,
    [string]$ExportarMsinfo
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/Get-CertifyHubInventory.ps1"
$os = Get-CimInstance -ClassName Win32_OperatingSystem -Property BuildNumber, SystemDrive, TotalVisibleMemorySize, Caption, LastBootUpTime, FreePhysicalMemory
$computer = Get-CimInstance -ClassName Win32_ComputerSystem -Property NumberOfLogicalProcessors, Manufacturer, Model
$disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$($os.SystemDrive)'" -Property FreeSpace, Size
if ($null -eq $disk.FreeSpace -or $null -eq $os.TotalVisibleMemorySize) {
    throw 'No se pudieron leer las métricas del equipo.'
}

$report = [ordered]@{
    windows_build = [string]$os.BuildNumber
    logical_processors = [int]$computer.NumberOfLogicalProcessors
    memory_bytes = [long]($os.TotalVisibleMemorySize * 1KB)
    system_disk_free_bytes = [long]$disk.FreeSpace
    inventory = Get-CertifyHubInventory -Os $os -Computer $computer -Volume $disk -BuscarActualizaciones:$BuscarActualizaciones
}
$json = $report | ConvertTo-Json -Depth 6 -Compress

if ($ExportarMsinfo) {
    $path = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($ExportarMsinfo)
    if ([IO.Path]::GetExtension($path) -ne '.nfo' -or (Test-Path -LiteralPath $path)) {
        throw 'Indica una ruta nueva con extensión .nfo.'
    }
    Start-Process -FilePath msinfo32.exe -ArgumentList "/nfo `"$path`"" -WindowStyle Hidden -Wait
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'MSINFO32 no generó el archivo.' }
}

if ($Enviar) {
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:${PuertoApi}/diagnostics" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 10
} else {
    $json
}
