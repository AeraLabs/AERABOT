# AERA Local AI Stack

AERA is designed to use local inference through adapters instead of depending on a paid model API.

## Design rule

AERA Core does not care which model family is loaded. It talks to a normalized local provider interface.

Current adapters:

1. **Ollama** at `127.0.0.1:11434`
2. **llama.cpp server** at `127.0.0.1:8080`
3. **Generic OpenAI-compatible local server**, configured with `AERA_OPENAI_LOCAL_URL`

Any model that those local runtimes can load and expose through their supported chat interface can be used by AERA. The model list is discovered at runtime. AERA does not hardcode one vendor or one model family.

This is intentional: newly released open-weight chat, coding, reasoning, or small CPU-friendly models can become available to AERA without an AERABOT release.

## Ollama

Run Ollama locally and install whichever locally licensed model you want to use. AERA calls the loopback `/api/chat` interface and discovers installed models from `/api/tags`.

AERA does not call Ollama cloud endpoints.

## llama.cpp

Run llama.cpp's local server on port 8080. AERA discovers the loaded model from `/v1/models` and sends chat requests to `/v1/chat/completions`.

llama.cpp is especially important for AERA because GGUF quantization and CPU execution provide a practical fallback for older hardware and Intel Macs.

## Other OpenAI-compatible local runtimes

AERA can use another local runtime that exposes the common OpenAI-compatible:

```text
GET  /models
POST /chat/completions
```

Set the runtime's local `/v1` root before starting AERA:

### macOS

```bash
export AERA_OPENAI_LOCAL_URL=http://127.0.0.1:8000/v1
```

### Windows PowerShell

```powershell
$env:AERA_OPENAI_LOCAL_URL = "http://127.0.0.1:8000/v1"
```

This endpoint is deliberately restricted to explicit loopback hosts:

- `127.0.0.1`
- `localhost`
- `::1`

Remote hosts, LAN addresses, HTTPS cloud URLs, embedded credentials, query strings, and fragments are rejected by the native runtime.

That makes the adapter useful for many free/open inference servers without quietly weakening AERA's local-first boundary.

## Local speech-to-text

AERA supports the local whisper.cpp HTTP server at:

```text
http://127.0.0.1:8081
```

Port 8081 avoids collision with AERA's default llama.cpp endpoint.

```text
Microphone
  -> mono PCM
  -> 16 kHz WAV
  -> native Tauri IPC
  -> whisper.cpp /inference
  -> transcript
  -> AERA Core
```

No recording is sent anywhere else by AERA.

## Local talk-back

AERA supports Piper's local HTTP server at:

```text
http://127.0.0.1:5000
```

```text
Local LLM reply
  -> native Tauri IPC
  -> Piper /synthesize
  -> WAV bytes
  -> local playback
```

If Piper is unavailable, AERA remains usable with text and earcons.

## Action safety

Language generation and computer control are separate systems.

The model can propose only planner actions allowed by AERA's constrained action protocol. A Skill independently validates the proposed input and assigns the risk class. The permission engine then executes and journals the action.

The first real action is deliberately narrow:

```text
software.open
  appId = reaper
```

The model cannot supply executable paths or arbitrary commands.

## Model licensing

AERA does not bundle model weights in this repository. Different models have different licenses. The provider discovers what the user has installed; distribution and model-license decisions remain separate from the AERA runtime.
