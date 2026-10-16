# Local CORS Proxy Guide (Standalone & Local Dev)

> **Bypass browser CORS restrictions in Standalone mode (GitLab Pages / Static Hosting)**  
> 100% local, zero external npm dependencies, no data leaves your machine.

---

## 1. Why is this proxy needed?

When the MCP Inspector runs directly in the browser from a public or remote HTTPS origin (e.g. `https://mcp-use-fork-417a01.pages.gitlab.disney.com/`):
- **Same-Origin Policy & CORS**: The browser rejects direct HTTP/HTTPS requests to local servers (`https://localhost:8443`, `http://localhost:11434` for Ollama, OpenAI-compatible APIs) unless they explicitly return valid `Access-Control-Allow-Origin` headers.
- **Private Network Access (PNA)**: Chromium browsers block requests initiated from a public HTTPS context to private or loopback addresses (`127.0.0.1` / `localhost`) unless the target server returns `Access-Control-Allow-Private-Network: true`.
- **Target Server Origin Filtering (`ALLOWED_ORIGINS`)**: Even if the target server restricts origins, the local proxy strips the client's `origin` header so the target treats the request as a direct, trusted server-to-server call.

The **Local CORS Proxy** provided in this fork solves all three constraints by running purely on loopback (`127.0.0.1:3020`).

---

## 2. Quick Start

The proxy is implemented using pure Node.js standard library (`node:http` and `node:https`): **no `npm install` required**.

### macOS & Linux
```bash
# Start with default port (3020):
./scripts/fork/run-cors-proxy.sh

# Start with a custom port:
./scripts/fork/run-cors-proxy.sh 3050
```

### Windows
- **Command Prompt (CMD) or double-click**:
  ```cmd
  scripts\fork\run-cors-proxy.bat
  # Custom port:
  scripts\fork\run-cors-proxy.bat 3050
  ```
- **PowerShell**:
  ```powershell
  .\scripts\fork\run-cors-proxy.ps1
  # Custom port:
  .\scripts\fork\run-cors-proxy.ps1 3050
  ```

---

## 3. Inspector Configuration

In the Inspector connection form (Dashboard or *Connection Settings* tab):

1. Enter your **Target Server URL**:
   - E.g.: `https://localhost:8443/mcp`
   - Or Ollama: `http://localhost:11434`
2. Open the **Configuration** section:
   - **Connection Mode**: `Proxy` (or `Auto`)
   - **Proxy Endpoint**: `http://localhost:3020` (or your chosen port)
3. Click **Connect** or **Save**.

All requests from the Inspector will now route through the local proxy running on your machine, which handles CORS headers and transparent stream forwarding.

---

## 4. Example: Connecting to Local Ollama

### Option A: With the Local CORS Proxy
Start Ollama normally, and set `Proxy Endpoint: http://localhost:3020` in the Inspector.

### Option B: Without Proxy (allowing origins in Ollama directly)
On **macOS / Linux** (`zsh`):
```zsh
OLLAMA_ORIGINS="*" ollama serve
```
*(If Ollama runs via the macOS menubar application: execute `launchctl setenv OLLAMA_ORIGINS "*"` and quit & restart the Ollama app).*

On **Windows** (PowerShell):
```powershell
$env:OLLAMA_ORIGINS="*"
ollama serve
```

---

## 5. Security & Privacy

- **Strict Loopback (`127.0.0.1`)**: The proxy binds exclusively to loopback and does not expose ports on external network interfaces.
- **Zero Telemetry**: No payloads, URLs, or headers are transmitted outside your local environment.
- **Local Certificates**: Self-signed certificates on `localhost`, `127.0.0.1`, and `.local` are automatically trusted for development with tools like `mkcert`.
