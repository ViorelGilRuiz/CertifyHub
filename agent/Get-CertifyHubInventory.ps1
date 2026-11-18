function Read-Optional {
    param([scriptblock]$Query)
    try { & $Query } catch { }
}

function Get-CertifyHubInventory {
    param($Os, $Computer, $Volume, [switch]$BuscarActualizaciones)

    $cpu = Get-CimInstance Win32_Processor
    $processor = $cpu | Select-Object -First 1
    $architecture = switch ($processor.Architecture) {
        9 { 'x64' }
        12 { 'arm64' }
        $null { $null }
        default { 'other' }
    }
    $bios = Read-Optional { Get-CimInstance Win32_BIOS }
    $board = Read-Optional { Get-CimInstance Win32_BaseBoard | Select-Object -First 1 }
    $release = Read-Optional { Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' }
    $secureBoot = Read-Optional { Confirm-SecureBootUEFI -ErrorAction Stop }
    $secureBootRegistry = Read-Optional { Get-ItemPropertyValue 'HKLM:\SYSTEM\CurrentControlSet\Control\SecureBoot\State' UEFISecureBootEnabled }
    if ($null -eq $secureBoot -and $null -ne $secureBootRegistry) { $secureBoot = [bool]$secureBootRegistry }
    $firmware = if ($null -ne $secureBoot) { 'Uefi' } else {
        switch (Read-Optional { (Get-ComputerInfo -Property BiosFirmwareType).BiosFirmwareType.ToString() }) {
            'Uefi' { 'Uefi' }
            'Bios' { 'Bios' }
        }
    }
    $tpm = Read-Optional { Get-CimInstance -Namespace root\CIMV2\Security\MicrosoftTpm -ClassName Win32_Tpm }
    $modules = @(Read-Optional {
        Get-CimInstance Win32_PhysicalMemory | Select-Object -First 64 | ForEach-Object {
            $kind = switch ($_.SMBIOSMemoryType) {
                24 { 'DDR3' }
                26 { 'DDR4' }
                29 { 'LPDDR3' }
                30 { 'LPDDR4' }
                34 { 'DDR5' }
                35 { 'LPDDR5' }
            }
            @{
                slot = $_.DeviceLocator
                capacity = [long]$_.Capacity
                speed = $(if ($_.ConfiguredClockSpeed) { [long]$_.ConfiguredClockSpeed } else { $null })
                type = $kind
            }
        }
    })
    $slots = Read-Optional {
        (Get-CimInstance Win32_PhysicalMemoryArray | Where-Object Use -eq 3 | Measure-Object MemoryDevices -Sum).Sum
    }
    $systemDisk = Read-Optional {
        Get-Partition -DriveLetter $Os.SystemDrive.TrimEnd(':') -ErrorAction Stop | Get-Disk -ErrorAction Stop
    }
    $physicalDisks = @(Read-Optional { Get-PhysicalDisk -ErrorAction Stop | Select-Object -First 64 })
    $systemPhysical = $null
    if ($systemDisk.UniqueId) {
        $matchingDisks = @($physicalDisks | Where-Object UniqueId -eq $systemDisk.UniqueId)
        if ($matchingDisks.Count -eq 1) { $systemPhysical = $matchingDisks[0] }
    }
    $installed = @(Read-Optional {
        Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10 | ForEach-Object {
            @{ title = [string]$_.Description; kb = [string]$_.HotFixID; date = $(if ($_.InstalledOn -is [datetime]) { $_.InstalledOn.ToString('yyyy-MM-dd') } else { $null }) }
        }
    })
    $reboot = Read-Optional { [bool](New-Object -ComObject Microsoft.Update.SystemInfo).RebootRequired }
    $updates = if ($BuscarActualizaciones) { Get-CertifyHubUpdates } else { @{ status = 'not_requested'; count = $null; items = @() } }

    @{
        os = $Os.Caption
        release = $release.DisplayVersion
        revision = $release.UBR
        manufacturer = $Computer.Manufacturer
        model = $Computer.Model
        board = $board.Product
        bios = $bios.SMBIOSBIOSVersion
        firmware = $firmware
        secure_boot = $secureBoot
        tpm = $(if ($tpm.SpecVersion) { ($tpm.SpecVersion -split ',')[0].Trim() } else { $null })
        cpu = $processor.Name
        cores = $(if ($processor.NumberOfCores) { [long]($cpu | Measure-Object NumberOfCores -Sum).Sum } else { $null })
        clock_mhz = $processor.MaxClockSpeed
        architecture = $architecture
        ram_installed = $(if ($modules.Count) { [long]($modules | ForEach-Object { $_.capacity } | Measure-Object -Sum).Sum } else { $null })
        ram_slots = $(if ($slots -gt 0) { [long]$slots } else { $null })
        modules = $modules
        system_volume = $Volume.Size
        system_disk = $systemDisk.Size
        system_media = $(if ($systemPhysical) { [string]$systemPhysical.MediaType } else { $null })
        disks = @($physicalDisks | ForEach-Object {
            @{ model = [string]$_.FriendlyName; capacity = [long]$_.Size; media = [string]$_.MediaType; interface = [string]$_.BusType }
        })
        graphics = @(Read-Optional { Get-CimInstance Win32_VideoController | Select-Object -First 32 -ExpandProperty Name })
        installed_updates = $installed
        pending_updates = $updates.items
        update_count = $updates.count
        update_status = $updates.status
        reboot_required = $reboot
    }
}

function Get-CertifyHubUpdates {
    $job = Start-Job -ScriptBlock {
        $ErrorActionPreference = 'Stop'
        $searcher = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher()
        $result = $searcher.Search('IsInstalled=0 and IsHidden=0')
        if ($result.ResultCode -notin 2, 3) { throw 'Windows Update no completó la búsqueda.' }
        $items = @(for ($index = 0; $index -lt [Math]::Min(15, $result.Updates.Count); $index++) {
            $update = $result.Updates.Item($index)
            @{
                title = $update.Title.Substring(0, [Math]::Min(260, $update.Title.Length))
                kb = $(if ($update.KBArticleIDs.Count) { 'KB' + $update.KBArticleIDs.Item(0) } else { $null })
            }
        })
        @{ status = $(if ($result.ResultCode -eq 2) { 'complete' } else { 'partial' }); count = $result.Updates.Count; items = $items }
    }
    try {
        if (Wait-Job -Job $job -Timeout 40) {
            $data = Receive-Job -Job $job -ErrorAction SilentlyContinue
            if ($data) { return $data }
        }
        @{ status = 'unavailable'; count = $null; items = @() }
    } finally {
        Remove-Job -Job $job -Force
    }
}
