param(
    [string]$Url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
    [string]$ExpectedFileName = "",
    [string]$ExpectedSha256 = "",
    [int]$TimeoutSeconds = 180
)
$ErrorActionPreference = "Stop"
$body = @{
    url = $Url
    finalUrl = $Url
    filename = "download"
    headers = @{ "User-Agent" = "Mozilla/5.0 bridge-test" }
} | ConvertTo-Json -Depth 4

# The agent provisions a shared token into the extension folder on start;
# command endpoints reject requests without it (401) when one is present.
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$tokenFile = Join-Path $repoRoot "browser-extension\bridge-token.txt"
function Get-BridgeHeaders {
    $result = @{}
    if (Test-Path -LiteralPath $tokenFile) {
        $token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
        if ($token) { $result["X-Correntra-Token"] = $token }
    }
    return $result
}
$headers = Get-BridgeHeaders

$created = Invoke-RestMethod -Uri "http://127.0.0.1:27410/takeover" -Method Post -Body $body -ContentType "application/json" -Headers $headers -TimeoutSec 15
Write-Output ("takeover response: " + ($created | ConvertTo-Json -Compress))

if ($created.accepted -and $created.jobId) {
    $confirmBody = @{ jobId = $created.jobId; startImmediately = $true } | ConvertTo-Json
    $confirmed = Invoke-RestMethod -Uri "http://127.0.0.1:27410/confirm" -Method Post -Body $confirmBody -ContentType "application/json" -Headers $headers -TimeoutSec 10
    Write-Output ("confirm response: " + ($confirmed | ConvertTo-Json -Compress))
    if (-not $confirmed.accepted) { throw "Confirmation rejected." }
} else {
    throw "Takeover rejected."
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $headers = Get-BridgeHeaders
    $jobs = Invoke-RestMethod -Uri "http://127.0.0.1:27410/jobs" -Headers $headers -TimeoutSec 10
    foreach ($job in ($jobs.jobs | Where-Object { $_.id -eq $created.jobId })) {
        if ($job.state -in 9, 10, 11) {
            Write-Output ("FINAL state=" + $job.state + " file=" + $job.fileName + " bytes=" + $job.bytesTransferred + "/" + $job.totalBytes)
            if ($job.state -ne 9) { throw "Download did not complete." }
            if ($job.fileName -eq "download") { throw "Generic filename was not resolved." }
            if ($ExpectedFileName) {
                $stem = [regex]::Escape([IO.Path]::GetFileNameWithoutExtension($ExpectedFileName))
                $extension = [regex]::Escape([IO.Path]::GetExtension($ExpectedFileName))
                if ($job.fileName -notmatch ("^" + $stem + '( \(\d+\))?' + $extension + '$')) { throw "Unexpected filename: $($job.fileName)" }
            }
            if ($ExpectedSha256) {
                $downloadPath = Join-Path (Join-Path $env:USERPROFILE "Downloads\Correntra\General") $job.fileName
                if ((Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash -ne $ExpectedSha256) { throw "Downloaded file hash mismatch." }
                Write-Output "SHA256 verified."
            }
            exit 0
        } else {
            Write-Output ("state=" + $job.state + " file=" + $job.fileName + " bytes=" + $job.bytesTransferred + "/" + $job.totalBytes)
        }
    }
}
Write-Output "TIMEOUT"
exit 2
