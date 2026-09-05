$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    $adb = 'adb'
}

$liveHost = '127.0.0.1'
$deviceIp = '192.168.100.33:5555'
$serverUrl = "http://${liveHost}:3000"
$serverCheckUrl = 'http://127.0.0.1:3000'
$backendUrl = 'http://127.0.0.1:5000'
$backendCheckUrl = 'http://127.0.0.1:5000/api/health'
$npmCommand = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCommand) {
    throw 'npm.cmd was not found. Install Node.js or add its installation directory to PATH.'
}

$env:REACT_APP_ANDROID_BUILD = 'true'
$env:CAPACITOR_LIVE_RELOAD = 'true'
$env:CAPACITOR_LIVE_RELOAD_HOST = $liveHost
$env:CAPACITOR_LIVE_RELOAD_URL = $serverUrl
$env:REACT_APP_API_URL = $backendUrl

Set-Location $projectRoot

Write-Host "Connecting to device $deviceIp..."
$connectErrorAction = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $connectOutput = & $adb connect $deviceIp 2>&1
}
finally {
    $ErrorActionPreference = $connectErrorAction
}
if ($LASTEXITCODE -ne 0) {
    throw "ADB could not connect to $deviceIp. $($connectOutput -join ' ')"
}
& $adb devices
& $adb -s $deviceIp reverse tcp:3000 tcp:3000
& $adb -s $deviceIp reverse tcp:5000 tcp:5000

Write-Host "Starting backend: $backendUrl"
$backendProcess = $null
$backendAlreadyRunning = @(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue).Count -gt 0
if (-not $backendAlreadyRunning) {
    $backendProcess = Start-Process -FilePath $npmCommand -ArgumentList 'start' -WorkingDirectory "$projectRoot\backend" -PassThru -WindowStyle Hidden
}

$backendDeadline = (Get-Date).AddSeconds(30)
$backendReady = $false
while ((Get-Date) -lt $backendDeadline) {
    if ($backendProcess -and $backendProcess.HasExited) {
        throw "Backend exited before becoming available (exit code $($backendProcess.ExitCode))"
    }
    try {
        Invoke-WebRequest -Uri $backendCheckUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
        $backendReady = $true
        break
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}
if (-not $backendReady) {
    throw "Backend did not become available at $backendCheckUrl"
}

Write-Host "Starting dev server: $serverUrl"
$serverProcess = $null
$serverAlreadyRunning = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count -gt 0
if (-not $serverAlreadyRunning) {
    $serverProcess = Start-Process -FilePath $npmCommand -ArgumentList 'start' -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden
}

if ($serverAlreadyRunning) {
    Write-Host "Using existing dev server on port 3000."
}

$serverStartupTimeoutSeconds = 120
$deadline = (Get-Date).AddSeconds($serverStartupTimeoutSeconds)
$serverReady = $false
while ((Get-Date) -lt $deadline) {
    if ($serverProcess -and $serverProcess.HasExited) {
        throw "React development server exited before becoming available (exit code $($serverProcess.ExitCode))"
    }
    try {
        Invoke-WebRequest -Uri $serverCheckUrl -UseBasicParsing -TimeoutSec 3 | Out-Null
        $serverReady = $true
        break
    }
    catch {
        Start-Sleep -Milliseconds 500
    }
}
if (-not $serverReady) {
    throw "React development server did not become available at $serverCheckUrl"
}

Write-Host "Building debug APK with live reload URL: $serverUrl"
npm run build
npx cap sync android

$generatedConfig = Get-Content "$projectRoot\android\app\src\main\assets\capacitor.config.json" | ConvertFrom-Json
if ($generatedConfig.server.url -ne $serverUrl) {
    throw "Generated Capacitor URL is '$($generatedConfig.server.url)' instead of '$serverUrl'"
}

Set-Location "$projectRoot\android"
.\gradlew.bat assembleDebug

$apkPath = "$projectRoot\android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
    throw "Debug APK was not generated at $apkPath"
}

Write-Host "Installing APK: $apkPath"
& $adb -s $deviceIp install -r $apkPath
if ($LASTEXITCODE -ne 0) {
    throw "APK installation failed on device $deviceIp"
}

Write-Host "Launching app..."
& $adb -s $deviceIp shell am start -n com.somalux.app/com.somalux.app.MainActivity

Write-Host "Live reload is active. App should load from $serverUrl"
