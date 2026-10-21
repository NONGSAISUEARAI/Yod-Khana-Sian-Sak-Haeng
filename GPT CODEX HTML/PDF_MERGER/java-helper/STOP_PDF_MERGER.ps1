$sessionFile = Join-Path $PSScriptRoot 'session.json'
if (Test-Path -LiteralPath $sessionFile) {
    $savedSession = Get-Content -LiteralPath $sessionFile -Raw | ConvertFrom-Json
    $processInfo = Get-CimInstance Win32_Process -Filter ('ProcessId = ' + [int]$savedSession.pid)
    if ($processInfo -and $processInfo.CommandLine -like '*pdf-merger-clipboard.jar*') {
        Stop-Process -Id $savedSession.pid
    }
}
