# Legt das App-Symbol „Werbemittel“ neben dem Ordner und auf dem Desktop an und startet die App.
$ErrorActionPreference = "Stop"
$system  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ordner  = Split-Path -Parent $system
$neben   = Split-Path -Parent $ordner
$ziel    = Join-Path $env:WINDIR "System32\wscript.exe"
$skript  = Join-Path $system "Werbemittel.vbs"
$symbol  = Join-Path $system "icons\werbemittel.ico"
$shell   = New-Object -ComObject WScript.Shell

function Verknuepfung($pfad){
  $v = $shell.CreateShortcut($pfad)
  $v.TargetPath = $ziel
  $v.Arguments = '"' + $skript + '"'
  $v.WorkingDirectory = $system
  $v.IconLocation = $symbol + ",0"
  $v.Description = "GAUSS Werbemittel"
  $v.Save()
}

$orte = @((Join-Path $neben "Werbemittel.lnk"), (Join-Path ([Environment]::GetFolderPath("Desktop")) "Werbemittel.lnk"))
foreach ($o in $orte){
  try { Verknuepfung $o; Write-Host "App-Symbol angelegt: $o" } catch { Write-Host "Nicht möglich: $o ($($_.Exception.Message))" }
}

Write-Host ""
Write-Host "Ablage-Ordner: $ordner"
Write-Host "Die App startet jetzt. Für den Dauerbetrieb auf dem Server siehe System\LIESMICH.md (Dienst einrichten)."
Start-Process -FilePath $ziel -ArgumentList ('"' + $skript + '"')
