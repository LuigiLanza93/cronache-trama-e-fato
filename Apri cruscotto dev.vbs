Dim shell, rootDir, scriptPath, command
Set shell = CreateObject("WScript.Shell")

rootDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
scriptPath = rootDir & "\local-tools\dev-dashboard.ps1"
shell.CurrentDirectory = rootDir
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -Sta -WindowStyle Hidden -File """ & scriptPath & """"

shell.Run command, 1, False
