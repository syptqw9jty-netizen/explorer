' GAUSS Werbemittel starten: startet den Server, falls er noch nicht laeuft, und oeffnet die App im eigenen Fenster.
Option Explicit
Const PORT = "8080"
Dim sh, fso, sys, http, laeuft, url
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sys = fso.GetParentFolderName(WScript.ScriptFullName)
url = "http://localhost:" & PORT & "/"

Function Pruefen()
  Pruefen = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.Open "GET", url & "api?action=ping", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then Pruefen = True
  End If
  On Error GoTo 0
End Function

laeuft = Pruefen()
If Not laeuft Then
  If Not fso.FolderExists(sys & "\Daten") Then fso.CreateFolder(sys & "\Daten")
  sh.CurrentDirectory = sys & "\server"
  sh.Run "cmd /c set PORT=" & PORT & "&& node server.js >> """ & sys & "\Daten\server.log"" 2>&1", 0, False
  Dim i
  For i = 1 To 20
    WScript.Sleep 300
    If Pruefen() Then Exit For
  Next
End If

On Error Resume Next
sh.Run "msedge --app=" & url, 1, False
If Err.Number <> 0 Then
  Err.Clear
  sh.Run url, 1, False
End If
