# AERA Local AI Stack

AERA is designed to use local inference through adapters instead of depending on a paid model API.

## Design rule

AERA Core does not care which model family is loaded. It talks to a normalized local provider interface.

Current adapters:

1. **Ollama** at `127.0.0.1:11434`
2. **llama.cpp server** at `127.0.0.1:8080`

Any model that those local runtimes can load and expose through their supported chat interface can be used by AERA. The model list is discovered at runtime. AERA does not hardcode one vendor or one model family.

This is intentional: users can choose small CPU-friendly models, larger GPU models, coding models, general models, or future open models without rebuilding AERA.

## Ollama

Run Ollama locally and install whichever locally licensed model you want to use. AERA calls the loopback `/api/chat` interface and discovers installed models from `/api/tags`.

AERA does not call Ollama's cloud-hosted endpoints.

## llama.cpp

Run llama.cpp's local server on port 8080. AERA discovers the loaded model from `/v1/models` and sends chat requests to `/v1/chat/completions`.

llama.cpp is especially important for AERA because GGUF quantization and CPU execution provide a practical fallback for older hardware and Intel Macs.

## Local speech-to-text

AERA supports the local whisper.cpp HTTP server.

AERA expects it at:

```text
http://127.0.0.1:8081
```

Port 8081 is used so it does not collide with the default AERA llama.cpp endpoint.

The microphone capture path is:

```text
Microphone
  -> browser audio capture
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

The reply path is:

```text
Local LLM reply
  -> native Tauri IPC
  -> Piper /synthesize
  -> WAV bytes
  -> local playback
```

If Piper is unavailable, AERA remains fully usable with text and earcons.

## Response modes

- **Auto** — speak when Piper is available; otherwise text
- **Text only** — never synthesize speech
- **Local voice** — prefer Piper when available

## Security boundary

The built-in local providers use fixed loopback addresses.

AERA does not accept an arbitrary remote LLM URL through these commands. This prevents a configuration change from silently turning a local-first assistant into a remote data path.

Real desktop actions are still separate from language generation:

```text
User
 -> local model
 -> intent / response
 -> AERA Core
 -> Skill
 -> permission engine
 -> execution
 -> journal
```

A model response alone is never proof that a computer action happened.

## Model licensing

AERA does not bundle model weights in this repository. Different models have different licenses. The provider discovers what the user has installed; distribution and model-license decisions remain separate from the AERA runtime.
