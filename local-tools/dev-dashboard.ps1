try {
  $ErrorActionPreference = 'Stop'

  $script:RootDir = Split-Path -Parent $PSScriptRoot
  $script:StateDir = Join-Path $PSScriptRoot '.dev-dashboard'
  $script:PidFile = Join-Path $script:StateDir 'dev-server.pid'
  $script:OutLog = Join-Path $script:StateDir 'dev-server.out.log'
  $script:ErrLog = Join-Path $script:StateDir 'dev-server.err.log'
  $script:BootLog = Join-Path $script:StateDir 'dashboard-startup.log'
  $script:SettingsFile = Join-Path $script:StateDir 'settings.json'
  $script:AppPort = 3000
  $script:LaunchMode = 'table'

  New-Item -ItemType Directory -Path $script:StateDir -Force | Out-Null
  Set-Content -Path $script:BootLog -Value ("[" + (Get-Date).ToString("s") + "] avvio cruscotto") -Encoding UTF8

  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing

function Get-NodePath {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return $null }
  return $cmd.Source
}

function Get-NpmPath {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $cmd) { $cmd = Get-Command npm -ErrorAction SilentlyContinue }
  if (-not $cmd) { return $null }
  return $cmd.Source
}

function Load-Settings {
  if (-not (Test-Path $script:SettingsFile)) { return }
  try {
    $settings = Get-Content $script:SettingsFile -Raw -ErrorAction Stop | ConvertFrom-Json
    if ($settings.port) {
      $loadedPort = 0
      if ([int]::TryParse([string]$settings.port, [ref]$loadedPort) -and $loadedPort -ge 1 -and $loadedPort -le 65535) {
        $script:AppPort = $loadedPort
      }
    }
    if ($settings.mode -and @('table', 'private', 'dev') -contains [string]$settings.mode) {
      $script:LaunchMode = [string]$settings.mode
    }
  }
  catch {
    Add-Content -Path $script:BootLog -Value ("[" + (Get-Date).ToString("s") + "] settings-load-error: " + $_.Exception.Message) -Encoding UTF8
  }
}

function Save-Settings {
  $payload = @{ port = $script:AppPort; mode = $script:LaunchMode } | ConvertTo-Json
  Set-Content -Path $script:SettingsFile -Value $payload -Encoding UTF8
}

function Get-LaunchModeProfiles {
  return @(
    [PSCustomObject]@{
      Id = 'table'
      Label = 'Sessione giocatori - produzione LAN'
      Description = 'Consigliata al tavolo: usa dist/ e condivide l''app in rete.'
      NodeEnv = 'production'
      Host = '0.0.0.0'
      ShowNetworkUrls = $true
    },
    [PSCustomObject]@{
      Id = 'private'
      Label = 'Solo DM - produzione locale'
      Description = 'Usa dist/ ma ascolta solo su questo PC.'
      NodeEnv = 'production'
      Host = '127.0.0.1'
      ShowNetworkUrls = $false
    },
    [PSCustomObject]@{
      Id = 'dev'
      Label = 'Sviluppo locale - Vite'
      Description = 'Solo per modificare codice: non condividerla con i player.'
      NodeEnv = 'development'
      Host = '127.0.0.1'
      ShowNetworkUrls = $false
    }
  )
}

function Get-LaunchModeProfile {
  $profile = Get-LaunchModeProfiles | Where-Object { $_.Id -eq $script:LaunchMode } | Select-Object -First 1
  if ($profile) { return $profile }
  $script:LaunchMode = 'table'
  Save-Settings
  return Get-LaunchModeProfiles | Where-Object { $_.Id -eq $script:LaunchMode } | Select-Object -First 1
}

function Set-LaunchMode([string]$modeId) {
  if (-not (@('table', 'private', 'dev') -contains $modeId)) { return $false }
  $script:LaunchMode = $modeId
  Save-Settings
  return $true
}

function Try-SetAppPort([string]$candidate) {
  $newPort = 0
  if (-not [int]::TryParse([string]$candidate, [ref]$newPort)) {
    return $false
  }
  if ($newPort -lt 1 -or $newPort -gt 65535) {
    return $false
  }
  $script:AppPort = $newPort
  Save-Settings
  return $true
}

Load-Settings

function Get-ServerPid {
  if (-not (Test-Path $script:PidFile)) { return $null }
  $raw = Get-Content $script:PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  $parsedPid = 0
  if ([int]::TryParse([string]$raw, [ref]$parsedPid)) { return $parsedPid }
  return $null
}

function Test-ServerRunning {
  $serverPid = Get-ServerPid
  if (-not $serverPid) { return $false }
  $proc = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
  if (-not $proc) {
    Remove-Item $script:PidFile -Force -ErrorAction SilentlyContinue
    return $false
  }
  return $true
}

function Get-AppUrls {
  $profile = Get-LaunchModeProfile
  $urls = New-Object System.Collections.Generic.List[string]
  $urls.Add("Locale: http://localhost:$($script:AppPort)")
  if (-not $profile.ShowNetworkUrls) {
    return $urls
  }
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.ValidLifetime -ne ([TimeSpan]::Zero)
    } |
    Sort-Object InterfaceMetric, IPAddress -Unique |
    ForEach-Object {
      $urls.Add("Rete: http://$($_.IPAddress):$($script:AppPort)")
    }
  return $urls
}

function Start-DevServer {
  $profile = Get-LaunchModeProfile
  if (Test-ServerRunning) {
    return "Il server è già in esecuzione."
  }

  $nodePath = Get-NodePath
  if (-not $nodePath) {
    throw "Non trovo 'node' nel PATH di sistema."
  }

  if ($profile.NodeEnv -eq 'production' -and -not (Test-Path (Join-Path $script:RootDir 'dist\index.html'))) {
    throw "Non trovo dist\index.html. Esegui prima 'npm run build' dal terminale, poi riavvia in modalita produzione."
  }

  Remove-Item $script:OutLog, $script:ErrLog -Force -ErrorAction SilentlyContinue

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $nodePath
  $psi.Arguments = 'server.js'
  $psi.WorkingDirectory = $script:RootDir
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.Environment['NODE_ENV'] = $profile.NodeEnv
  $psi.Environment['PORT'] = [string]$script:AppPort
  $psi.Environment['HOST'] = $profile.Host

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  $proc.EnableRaisingEvents = $true

  $outWriter = [System.IO.StreamWriter]::new($script:OutLog, $true, [System.Text.Encoding]::UTF8)
  $errWriter = [System.IO.StreamWriter]::new($script:ErrLog, $true, [System.Text.Encoding]::UTF8)

  Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
    if ($EventArgs.Data) {
      Add-Content -Path $using:script:OutLog -Value $EventArgs.Data -Encoding UTF8
    }
  } | Out-Null
  Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
    if ($EventArgs.Data) {
      Add-Content -Path $using:script:ErrLog -Value $EventArgs.Data -Encoding UTF8
    }
  } | Out-Null

  if (-not $proc.Start()) {
    $outWriter.Dispose()
    $errWriter.Dispose()
    throw "Non sono riuscito ad avviare il processo Node."
  }
  $outWriter.Dispose()
  $errWriter.Dispose()

  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()

  Set-Content -Path $script:PidFile -Value $proc.Id -Encoding UTF8
  return "Avvio richiesto (PID $($proc.Id), $($profile.Label))."
}

function Stop-DevServer {
  $serverPid = Get-ServerPid
  if (-not $serverPid) {
    return "Nessun server in esecuzione."
  }

  Start-Process -FilePath taskkill.exe -ArgumentList '/PID', $serverPid, '/T', '/F' -WindowStyle Hidden -Wait | Out-Null
  Remove-Item $script:PidFile -Force -ErrorAction SilentlyContinue
  return "Arresto richiesto (PID $serverPid)."
}

function Restart-DevServer {
  [void](Stop-DevServer)
  Start-Sleep -Milliseconds 500
  return Start-DevServer
}

function Build-App {
  if (Test-ServerRunning) {
    throw "Ferma il server prima di aggiornare la build."
  }

  $npmPath = Get-NpmPath
  if (-not $npmPath) {
    throw "Non trovo 'npm' nel PATH di sistema."
  }

  Remove-Item $script:OutLog, $script:ErrLog -Force -ErrorAction SilentlyContinue

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $npmPath
  $psi.Arguments = 'run build'
  $psi.WorkingDirectory = $script:RootDir
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi

  if (-not $proc.Start()) {
    throw "Non sono riuscito ad avviare npm run build."
  }

  $stdout = $proc.StandardOutput.ReadToEnd()
  $stderr = $proc.StandardError.ReadToEnd()
  $proc.WaitForExit()

  if ($stdout) { Set-Content -Path $script:OutLog -Value $stdout -Encoding UTF8 }
  if ($stderr) { Set-Content -Path $script:ErrLog -Value $stderr -Encoding UTF8 }

  if ($proc.ExitCode -ne 0) {
    throw "Build non riuscita. Controlla i log recenti nel cruscotto."
  }

  return "Build aggiornata correttamente."
}

function Read-RecentLogs {
  $rows = New-Object System.Collections.Generic.List[string]
  foreach ($path in @($script:OutLog, $script:ErrLog)) {
    if (Test-Path $path) {
      $label = if ($path -eq $script:OutLog) { 'OUT' } else { 'ERR' }
      Get-Content $path -Tail 80 -ErrorAction SilentlyContinue | ForEach-Object {
        $rows.Add("[$label] $_")
      }
    }
  }
  return ($rows | Select-Object -Last 120) -join [Environment]::NewLine
}

function Open-AppInBrowser {
  Start-Process "http://localhost:$($script:AppPort)" | Out-Null
}

function Get-SelectedUrl {
  if (-not $urlsBox.SelectedItem) { return $null }
  $value = [string]$urlsBox.SelectedItem
  $parts = $value -split ':\s+', 2
  if ($parts.Length -lt 2) { return $null }
  return $parts[1]
}

function Copy-SelectedUrl {
  $url = Get-SelectedUrl
  if (-not $url) { return $false }
  [System.Windows.Forms.Clipboard]::SetText($url)
  return $true
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Cruscotto Dev - App D&D'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(820, 640)
$form.MinimumSize = New-Object System.Drawing.Size(760, 560)
$form.BackColor = [System.Drawing.Color]::FromArgb(24, 18, 14)
$form.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Cruscotto Dev'
$title.Font = New-Object System.Drawing.Font('Georgia', 18, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = [System.Drawing.Color]::FromArgb(232, 93, 74)
$title.Location = New-Object System.Drawing.Point(20, 18)
$title.AutoSize = $true
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Avvia e gestisci il server dell''app senza usare il terminale.'
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(194, 173, 151)
$subtitle.Location = New-Object System.Drawing.Point(22, 54)
$subtitle.AutoSize = $true
$form.Controls.Add($subtitle)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Location = New-Object System.Drawing.Point(22, 95)
$statusLabel.Size = New-Object System.Drawing.Size(500, 24)
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($statusLabel)

$pidLabel = New-Object System.Windows.Forms.Label
$pidLabel.Location = New-Object System.Drawing.Point(22, 126)
$pidLabel.Size = New-Object System.Drawing.Size(300, 22)
$pidLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.Controls.Add($pidLabel)

$portLabel = New-Object System.Windows.Forms.Label
$portLabel.Text = 'Porta'
$portLabel.Location = New-Object System.Drawing.Point(560, 98)
$portLabel.Size = New-Object System.Drawing.Size(44, 22)
$portLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.Controls.Add($portLabel)

$portBox = New-Object System.Windows.Forms.TextBox
$portBox.Location = New-Object System.Drawing.Point(610, 95)
$portBox.Size = New-Object System.Drawing.Size(70, 24)
$portBox.BackColor = [System.Drawing.Color]::FromArgb(36, 26, 20)
$portBox.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$portBox.BorderStyle = 'FixedSingle'
$portBox.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$portBox.Text = [string]$script:AppPort
$form.Controls.Add($portBox)

$savePortButton = New-Object System.Windows.Forms.Button
$savePortButton.Text = 'Salva'
$savePortButton.Location = New-Object System.Drawing.Point(690, 92)
$savePortButton.Size = New-Object System.Drawing.Size(74, 30)
$savePortButton.FlatStyle = 'Flat'
$savePortButton.BackColor = [System.Drawing.Color]::FromArgb(43, 32, 25)
$savePortButton.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$form.Controls.Add($savePortButton)

$modeLabel = New-Object System.Windows.Forms.Label
$modeLabel.Text = 'Modalita'
$modeLabel.Location = New-Object System.Drawing.Point(560, 132)
$modeLabel.Size = New-Object System.Drawing.Size(62, 22)
$modeLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$form.Controls.Add($modeLabel)

$modeBox = New-Object System.Windows.Forms.ComboBox
$modeBox.Location = New-Object System.Drawing.Point(626, 129)
$modeBox.Size = New-Object System.Drawing.Size(156, 24)
$modeBox.DropDownStyle = 'DropDownList'
$modeBox.BackColor = [System.Drawing.Color]::FromArgb(36, 26, 20)
$modeBox.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$modeBox.Font = New-Object System.Drawing.Font('Segoe UI', 9)
foreach ($profile in Get-LaunchModeProfiles) {
  [void]$modeBox.Items.Add($profile.Label)
}
$form.Controls.Add($modeBox)

$modeHelpLabel = New-Object System.Windows.Forms.Label
$modeHelpLabel.Location = New-Object System.Drawing.Point(560, 202)
$modeHelpLabel.Size = New-Object System.Drawing.Size(222, 42)
$modeHelpLabel.Font = New-Object System.Drawing.Font('Segoe UI', 8)
$modeHelpLabel.ForeColor = [System.Drawing.Color]::FromArgb(194, 173, 151)
$form.Controls.Add($modeHelpLabel)

$buttonY = 160
function New-ActionButton([string]$text, [int]$x) {
  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = $text
  $btn.Location = New-Object System.Drawing.Point($x, $buttonY)
  $btn.Size = New-Object System.Drawing.Size(120, 34)
  $btn.FlatStyle = 'Flat'
  $btn.BackColor = [System.Drawing.Color]::FromArgb(43, 32, 25)
  $btn.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
  return $btn
}

$startButton = New-ActionButton 'Avvia' 22
$stopButton = New-ActionButton 'Ferma' 154
$restartButton = New-ActionButton 'Riavvia' 286
$openButton = New-ActionButton 'Apri app' 418
$buildButton = New-ActionButton 'Build' 550

$form.Controls.AddRange(@($startButton, $stopButton, $restartButton, $openButton, $buildButton))

$urlsTitle = New-Object System.Windows.Forms.Label
$urlsTitle.Text = 'Indirizzi'
$urlsTitle.Font = New-Object System.Drawing.Font('Georgia', 12, [System.Drawing.FontStyle]::Bold)
$urlsTitle.ForeColor = [System.Drawing.Color]::FromArgb(245, 192, 137)
$urlsTitle.Location = New-Object System.Drawing.Point(22, 250)
$urlsTitle.AutoSize = $true
$form.Controls.Add($urlsTitle)

$copyUrlButton = New-Object System.Windows.Forms.Button
$copyUrlButton.Text = 'Copia indirizzo'
$copyUrlButton.Location = New-Object System.Drawing.Point(640, 244)
$copyUrlButton.Size = New-Object System.Drawing.Size(142, 32)
$copyUrlButton.FlatStyle = 'Flat'
$copyUrlButton.BackColor = [System.Drawing.Color]::FromArgb(43, 32, 25)
$copyUrlButton.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$form.Controls.Add($copyUrlButton)

$urlsBox = New-Object System.Windows.Forms.ListBox
$urlsBox.Location = New-Object System.Drawing.Point(22, 280)
$urlsBox.Size = New-Object System.Drawing.Size(760, 100)
$urlsBox.BackColor = [System.Drawing.Color]::FromArgb(36, 26, 20)
$urlsBox.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$form.Controls.Add($urlsBox)

$logTitle = New-Object System.Windows.Forms.Label
$logTitle.Text = 'Log recenti'
$logTitle.Font = New-Object System.Drawing.Font('Georgia', 12, [System.Drawing.FontStyle]::Bold)
$logTitle.ForeColor = [System.Drawing.Color]::FromArgb(245, 192, 137)
$logTitle.Location = New-Object System.Drawing.Point(22, 400)
$logTitle.AutoSize = $true
$form.Controls.Add($logTitle)

$logBox = New-Object System.Windows.Forms.TextBox
$logBox.Location = New-Object System.Drawing.Point(22, 430)
$logBox.Size = New-Object System.Drawing.Size(760, 150)
$logBox.Multiline = $true
$logBox.ScrollBars = 'Vertical'
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::FromArgb(36, 26, 20)
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(240, 225, 207)
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)
$form.Controls.Add($logBox)

$messageTimer = New-Object System.Windows.Forms.Timer
$messageTimer.Interval = 1500
$refreshTimer = New-Object System.Windows.Forms.Timer
$refreshTimer.Interval = 2000

function Refresh-Ui {
  $running = Test-ServerRunning
  $profile = Get-LaunchModeProfile
  $statusLabel.Text = if ($running) { 'Stato: server attivo' } else { 'Stato: server fermo' }
  $statusLabel.ForeColor = if ($running) {
    [System.Drawing.Color]::FromArgb(87, 199, 133)
  } else {
    [System.Drawing.Color]::FromArgb(194, 173, 151)
  }
  $pidLabel.Text = if ($running) { "PID: $(Get-ServerPid)" } else { 'PID: -' }

  $startButton.Enabled = -not $running
  $stopButton.Enabled = $running
  $restartButton.Enabled = $running
  $buildButton.Enabled = -not $running
  $portBox.Enabled = -not $running
  $savePortButton.Enabled = -not $running
  $modeBox.Enabled = -not $running
  if ($modeBox.SelectedItem -ne $profile.Label) {
    $modeBox.SelectedItem = $profile.Label
  }
  $modeHelpLabel.Text = $profile.Description
  if ($portBox.Text -ne [string]$script:AppPort -and -not $portBox.Focused) {
    $portBox.Text = [string]$script:AppPort
  }

  $urlsBox.Items.Clear()
  foreach ($entry in Get-AppUrls) {
    [void]$urlsBox.Items.Add($entry)
  }
  $copyUrlButton.Enabled = ($urlsBox.Items.Count -gt 0)

  $logText = Read-RecentLogs
  $logBox.Text = if ([string]::IsNullOrWhiteSpace($logText)) { 'Nessun log disponibile.' } else { $logText }
  $logBox.SelectionStart = $logBox.TextLength
  $logBox.ScrollToCaret()
}

function Flash-Status([string]$message) {
  $statusLabel.Text = $message
  $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(245, 192, 137)
  $messageTimer.Stop()
  $messageTimer.Start()
}

$messageTimer.Add_Tick({
  $messageTimer.Stop()
  Refresh-Ui
})

$refreshTimer.Add_Tick({
  Refresh-Ui
})

$startButton.Add_Click({
  try {
    Flash-Status (Start-DevServer)
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Errore avvio', 'OK', 'Error') | Out-Null
  }
  Refresh-Ui
})

$stopButton.Add_Click({
  try {
    Flash-Status (Stop-DevServer)
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Errore arresto', 'OK', 'Error') | Out-Null
  }
  Refresh-Ui
})

$restartButton.Add_Click({
  try {
    Flash-Status (Restart-DevServer)
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Errore riavvio', 'OK', 'Error') | Out-Null
  }
  Refresh-Ui
})

$openButton.Add_Click({
  Open-AppInBrowser
})

$buildButton.Add_Click({
  try {
    Flash-Status('Aggiorno la build...')
    $form.Refresh()
    Flash-Status (Build-App)
  } catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Errore build', 'OK', 'Error') | Out-Null
  }
  Refresh-Ui
})

$savePortButton.Add_Click({
  if (Try-SetAppPort $portBox.Text) {
    Flash-Status ("Porta salvata: " + $script:AppPort)
    Refresh-Ui
  }
  else {
    [System.Windows.Forms.MessageBox]::Show('Inserisci una porta valida tra 1 e 65535.', 'Porta non valida', 'OK', 'Warning') | Out-Null
    $portBox.Text = [string]$script:AppPort
    $portBox.SelectAll()
    $portBox.Focus()
  }
})

$modeBox.Add_SelectedIndexChanged({
  if (Test-ServerRunning) { return }
  $selectedLabel = [string]$modeBox.SelectedItem
  $selectedProfile = Get-LaunchModeProfiles | Where-Object { $_.Label -eq $selectedLabel } | Select-Object -First 1
  if ($selectedProfile -and (Set-LaunchMode $selectedProfile.Id)) {
    $modeHelpLabel.Text = $selectedProfile.Description
    Refresh-Ui
  }
})

$portBox.Add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
    $savePortButton.PerformClick()
    $eventArgs.SuppressKeyPress = $true
  }
})

$copyUrlButton.Add_Click({
  if (Copy-SelectedUrl) {
    Flash-Status('Indirizzo copiato negli appunti.')
  }
  else {
    [System.Windows.Forms.MessageBox]::Show('Seleziona prima un indirizzo dall''elenco.', 'Nessun indirizzo selezionato', 'OK', 'Information') | Out-Null
  }
})

$urlsBox.Add_DoubleClick({
  $url = Get-SelectedUrl
  if ($url) { Start-Process $url | Out-Null }
})

$urlsBox.Add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.Control -and $eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::C) {
    if (Copy-SelectedUrl) {
      Flash-Status('Indirizzo copiato negli appunti.')
    }
    $eventArgs.SuppressKeyPress = $true
  }
})

  $form.Add_Shown({
    Refresh-Ui
    $refreshTimer.Start()
  })

  [void]$form.ShowDialog()
}
catch {
  $fallbackDir = Join-Path $PSScriptRoot '.dev-dashboard'
  New-Item -ItemType Directory -Path $fallbackDir -Force -ErrorAction SilentlyContinue | Out-Null
  $fallbackLog = Join-Path $fallbackDir 'dashboard-startup.log'
  $message = "[" + (Get-Date).ToString("s") + "] " + $_.Exception.ToString()
  Set-Content -Path $fallbackLog -Value $message -Encoding UTF8
  throw
}
