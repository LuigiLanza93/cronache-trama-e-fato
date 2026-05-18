param(
  [string]$TaskName = "CronacheProductionDatabaseBackup",
  [string]$At = "03:00",
  [string]$OutputDir = ".backups/railway",
  [int]$Keep = 30
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$backupScript = Join-Path $PSScriptRoot "backup-prod-db.ps1"

$token = [Environment]::GetEnvironmentVariable("CRONACHE_BACKUP_TOKEN", "User")
if ([string]::IsNullOrWhiteSpace($token)) {
  $token = [Environment]::GetEnvironmentVariable("DATABASE_BACKUP_TOKEN", "User")
}
if ([string]::IsNullOrWhiteSpace($token)) {
  throw "Set CRONACHE_BACKUP_TOKEN or DATABASE_BACKUP_TOKEN as a User environment variable before registering the task."
}

$time = [DateTime]::ParseExact($At, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$backupScript`" -OutputDir `"$OutputDir`" -Keep $Keep"

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument $arguments `
  -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description "Downloads a consistent SQLite backup from Cronache production." `
  -Force | Out-Null

Write-Host "Scheduled task registered: $TaskName"
Write-Host "Daily time: $At"
