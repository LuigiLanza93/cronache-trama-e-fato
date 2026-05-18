param(
  [string]$BackupUrl = "https://cronache-trama-fato.up.railway.app/api/admin/backups/database",
  [string]$OutputDir = ".backups/railway",
  [int]$Keep = 30
)

$ErrorActionPreference = "Stop"

$token = $env:CRONACHE_BACKUP_TOKEN
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = $env:DATABASE_BACKUP_TOKEN
}
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = [Environment]::GetEnvironmentVariable("CRONACHE_BACKUP_TOKEN", "User")
}
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = [Environment]::GetEnvironmentVariable("DATABASE_BACKUP_TOKEN", "User")
}
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Set CRONACHE_BACKUP_TOKEN or DATABASE_BACKUP_TOKEN before running this script."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedOutputDir = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
  $OutputDir
} else {
  Join-Path $repoRoot $OutputDir
}

New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$fallbackFileName = "cronache-prod-$timestamp.db"
$tempPath = Join-Path $resolvedOutputDir "$fallbackFileName.download"

$headers = @{
  Authorization = "Bearer $token"
  "X-Backup-Intent" = "cronache-prod-db-backup"
}

Write-Host "Requesting production database backup..."
try {
  $response = Invoke-WebRequest -Uri $BackupUrl -Method Post -Headers $headers -OutFile $tempPath -UseBasicParsing
} catch {
  if (Test-Path $tempPath) {
    Remove-Item -Force -Path $tempPath
  }
  throw
}

$fileName = $fallbackFileName
if ($response -and $response.Headers) {
  $contentDisposition = [string]$response.Headers["Content-Disposition"]
  if ($contentDisposition -match 'filename="?([^";]+)"?') {
    $fileName = $Matches[1]
  }
}

$finalPath = Join-Path $resolvedOutputDir $fileName
if (Test-Path $finalPath) {
  $finalPath = Join-Path $resolvedOutputDir "cronache-prod-$timestamp.db"
}

Move-Item -Force -Path $tempPath -Destination $finalPath

$file = Get-Item $finalPath
if ($file.Length -le 0) {
  Remove-Item -Force -Path $finalPath
  throw "Backup file is empty."
}

$expectedHash = if ($response -and $response.Headers) { [string]$response.Headers["X-Backup-Sha256"] } else { "" }
if (-not [string]::IsNullOrWhiteSpace($expectedHash)) {
  $actualHash = (Get-FileHash -Algorithm SHA256 -Path $finalPath).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash.ToLowerInvariant()) {
    Remove-Item -Force -Path $finalPath
    throw "Backup checksum mismatch."
  }
}

if ($Keep -gt 0) {
  Get-ChildItem -Path $resolvedOutputDir -Filter "*.db" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip $Keep |
    Remove-Item -Force
}

Write-Host "Backup saved: $finalPath"
Write-Host "Size: $($file.Length) bytes"
