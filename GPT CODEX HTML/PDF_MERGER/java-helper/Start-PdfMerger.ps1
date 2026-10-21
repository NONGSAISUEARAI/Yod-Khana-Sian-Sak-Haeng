$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
try {
    $helperDirectory = $PSScriptRoot
    $workspaceDirectory = Split-Path (Split-Path $helperDirectory -Parent) -Parent
    $sessionPath = Join-Path $helperDirectory 'session.json'
    if (Test-Path -LiteralPath $sessionPath) {
        try {
            $sessionInfo = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
            if ($sessionInfo.url -match '^http://127\.0\.0\.1:\d+/[a-f0-9]{48}/$') {
                $health = Invoke-WebRequest -Uri ($sessionInfo.url + 'health') -UseBasicParsing -TimeoutSec 2
                if ($health.Content -eq 'PDF_MERGER_JAVA_READY') {
                    Start-Process $sessionInfo.url
                    exit
                }
            }
        } catch { }
    }
    $javaExecutable = Join-Path $helperDirectory 'runtime/bin/javaw.exe'
    if (!(Test-Path -LiteralPath $javaExecutable)) { throw 'Portable Java runtime is missing. Keep the entire PDF_MERGER folder together.' }
    $jarPath = Join-Path $helperDirectory 'pdf-merger-clipboard.jar'
    $arguments = '-jar "' + $jarPath + '" "' + $workspaceDirectory + '"'
    $helperProcess = Start-Process -FilePath $javaExecutable -ArgumentList $arguments -WorkingDirectory $workspaceDirectory -WindowStyle Hidden -PassThru
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        Start-Sleep -Milliseconds 200
        if (Test-Path -LiteralPath $sessionPath) {
            $readySession = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
            if ($readySession.pid -eq $helperProcess.Id) { exit }
        }
        if ($helperProcess.HasExited) { throw 'Java helper exited before it was ready.' }
    }
    throw 'Java helper did not start in time.'
} catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'PDF Merger Java helper') | Out-Null
}
