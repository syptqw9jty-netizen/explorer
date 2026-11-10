//go:build windows

// Werbemittel.exe – startet die App aus dem Ordner „Werbemittel-System“ daneben.
// Läuft schon ein Werbemittel-Server dieses Ordners auf diesem Rechner, wird nur das Fenster geöffnet;
// sonst startet er den mitgelieferten Node-Server unsichtbar und öffnet dann die App.
package main

import (
	"encoding/json"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const ersterPort = 47800

var (
	user32       = syscall.NewLazyDLL("user32.dll")
	shell32      = syscall.NewLazyDLL("shell32.dll")
	messageBox   = user32.NewProc("MessageBoxW")
	shellExecute = shell32.NewProc("ShellExecuteW")
)

func u(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }

func meldung(text string) {
	messageBox.Call(0, uintptr(unsafe.Pointer(u(text))), uintptr(unsafe.Pointer(u("Werbemittel"))), 0x10)
}

func oeffne(datei, param string) bool {
	r, _, _ := shellExecute.Call(0, uintptr(unsafe.Pointer(u("open"))), uintptr(unsafe.Pointer(u(datei))), uintptr(unsafe.Pointer(u(param))), 0, 1)
	return r > 32
}

// 0 = Port frei, 1 = unser Server, 2 = etwas anderes
func pruefe(port int, app string) int {
	if l, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port)); err == nil {
		l.Close()
		return 0
	}
	c := http.Client{Timeout: 1500 * time.Millisecond}
	r, err := c.Get("http://127.0.0.1:" + strconv.Itoa(port) + "/api?action=ping")
	if err != nil {
		return 2
	}
	defer r.Body.Close()
	var j struct {
		Server bool   `json:"server"`
		App    string `json:"app"`
	}
	if json.NewDecoder(r.Body).Decode(&j) != nil || !j.Server {
		return 2
	}
	if strings.EqualFold(filepath.Clean(j.App), filepath.Clean(app)) {
		return 1
	}
	return 2
}

func fenster(port int) {
	url := "http://127.0.0.1:" + strconv.Itoa(port) + "/"
	if !oeffne("msedge.exe", "--app="+url) {
		oeffne(url, "")
	}
}

func main() {
	exe, _ := os.Executable()
	exe, _ = filepath.EvalSymlinks(exe)
	sys := filepath.Join(filepath.Dir(exe), "Werbemittel-System")
	app := filepath.Join(sys, "App")
	if _, err := os.Stat(filepath.Join(app, "server", "server.js")); err != nil {
		meldung("Der Ordner „Werbemittel-System“ fehlt.\n\nWerbemittel und der Ordner „Werbemittel-System“ müssen immer zusammen im selben Ordner liegen. Bitte beide gemeinsam verschieben.")
		return
	}
	node := filepath.Join(app, "node", "node.exe")
	if _, err := os.Stat(node); err != nil {
		if p, err := exec.LookPath("node"); err == nil {
			node = p
		} else {
			meldung("Node.js wurde nicht gefunden (App\\node\\node.exe fehlt).")
			return
		}
	}
	for port := ersterPort; port < ersterPort+20; port++ {
		switch pruefe(port, app) {
		case 1:
			fenster(port)
			return
		case 0:
			daten := filepath.Join(app, "Daten")
			os.MkdirAll(daten, 0o755)
			rechner := os.Getenv("COMPUTERNAME")
			if rechner == "" {
				rechner = "rechner"
			}
			log, _ := os.OpenFile(filepath.Join(daten, "server-"+rechner+".log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
			cmd := exec.Command(node, "server.js")
			cmd.Dir = filepath.Join(app, "server")
			cmd.Env = append(os.Environ(), "PORT="+strconv.Itoa(port), "HOST=127.0.0.1", "LEERLAUF_MIN=30", "MEHRPLATZ=1")
			cmd.Stdout, cmd.Stderr = log, log
			cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000 | 0x00000200} // ohne Konsolenfenster, eigene Prozessgruppe
			if err := cmd.Start(); err != nil {
				meldung("Werbemittel konnte nicht starten:\n" + err.Error())
				return
			}
			for i := 0; i < 60; i++ {
				time.Sleep(250 * time.Millisecond)
				if pruefe(port, app) == 1 {
					fenster(port)
					return
				}
			}
			meldung("Werbemittel startet nicht. Details stehen in Werbemittel-System\\App\\Daten\\server-" + rechner + ".log")
			return
		}
	}
	meldung("Kein freier Port gefunden (47800–47819).")
}
