[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$PuertoApi = 8000
)

$ErrorActionPreference = 'Stop'
$baseUri = "http://127.0.0.1:${PuertoApi}/analysis"
$local = @{ 'X-CertifyHub-Local' = '1' }

function Send-AgentRequest {
    param([string]$Path, [string]$Json, [hashtable]$Headers = $local)
    Invoke-RestMethod -Method Post -Uri "$baseUri/$Path" -Headers $Headers -TimeoutSec 12 `
        -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($Json))
}

$identity = @{ device = $env:COMPUTERNAME } | ConvertTo-Json -Compress
while ($true) {
    $task = $null
    try {
        $task = Send-AgentRequest -Path 'claim' -Json $identity
        if ($task.id) {
            $headers = $local.Clone()
            $headers['X-CertifyHub-Lease'] = $task.lease
            $path = $task.id
            $json = & "$PSScriptRoot/Invoke-CertifyHubDiagnostic.ps1" -BuscarActualizaciones
            $null = Send-AgentRequest -Path "$path/progress" -Json '{"stage":"evaluating"}' -Headers $headers
            $data = $json | ConvertFrom-Json
            if (-not $data.inventory -or $data.logical_processors -lt 1) { throw 'Inventario incompleto.' }
            $null = Send-AgentRequest -Path "$path/progress" -Json '{"stage":"generating"}' -Headers $headers
            $null = Send-AgentRequest -Path "$path/report" -Json $json -Headers $headers
        }
    } catch {
        if ($task.id) {
            try { $null = Send-AgentRequest -Path "$path/progress" -Json '{"stage":"failed"}' -Headers $headers } catch { }
        }
        Write-Warning 'No se pudo completar la comunicación con CertifyHub. Se volverá a intentar.'
    }
    Start-Sleep -Seconds 2
}
