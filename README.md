# AERA Orb Desktop Runtime

AERA Orb is the local-first desktop intelligence runtime for AERA: a living transparent 3D orb, local voice/chat system, permissioned action engine, and extensible Skill platform for controlling creative software.

The product is intentionally divided into four boundaries:

- **Orb** — character, motion, light, sound, and desktop presence
- **AERA Core** — state, commands, permissions, execution, and journal
- **Local Intelligence** — interchangeable local model/speech runtimes
- **Skills** — validated semantic abilities for real software

A model is never treated as proof that an action happened. Real computer actions must pass through an installed Skill and AERA Core.

## Platforms

- **macOS Apple Silicon** — `aarch64-apple-darwin`
- **macOS Intel** — `x86_64-apple-darwin`, mandatory release target
- **Windows 10/11** — `x86_64-pc-windows-msvc`

GitHub Actions builds each target independently.

## What AERA can do now

### Desktop presence

- transparent frameless native host
- always-on-top orb
- native drag
- physical grow/shrink behavior
- six simulated depth zones
- multiple-monitor enumeration
- DPI-aware positioning
- persistent native desktop position
- safe recovery when a previously used monitor disappears
- global summon shortcut
  - macOS: **Command + Shift + Space**
  - Windows: **Ctrl + Shift + Space**

### Living orb

- realtime Three.js renderer
- crystal / glass physical material
- restrained silver, white, mint, and blue energy language
- internal shader motion
- waveform ring
- particles
- state-driven glow, scale, movement, opacity, and energy
- reduced-motion support
- efficiency rendering profile

### AERA states

`IDLE`, `AMBIENT`, `AWAKE`, `LISTENING`, `UNDERSTANDING`, `THINKING`, `ACTING`, `WAITING`, `SPEAKING`, `QUESTION`, `SUCCESS`, `WARNING`, `ERROR`, `SLEEPING`, `STUDIO`, `DND`.

The renderer observes real runtime state. It does not fabricate thinking/acting animations with timers.

### Free local intelligence

AERA does not require a paid LLM API.

Current adapters:

- **Ollama**
- **llama.cpp**
- **any configured OpenAI-compatible local server on explicit loopback**

Installed models are discovered at runtime. AERA does not hardcode one model family, so new open/local models can be used without changing AERA Core.

The generic OpenAI-compatible adapter is intentionally restricted to `127.0.0.1`, `localhost`, or `::1`. Remote and LAN endpoints are rejected by the native bridge.

### Free local voice

- microphone capture
- local mono PCM / 16 kHz WAV conversion
- **whisper.cpp** speech-to-text
- **Piper** local talk-back
- procedural earcons as a lightweight fallback
- text-only mode when speech services are unavailable

### Real Skill execution

The first software Skill is **REAPER**.

Implemented:

- detect REAPER
- launch REAPER through a whitelisted native application bridge
- play transport through loopback OSC
- stop transport through loopback OSC
- pause transport through loopback OSC
- journal executed actions

The local model proposes semantic actions. The Skill validates the target and input. AERA Core owns execution.

## Local model architecture

```text
                   user
                    │
             voice / text
                    │
          ┌─────────▼─────────┐
          │ local intelligence │
          │                   │
          │ Ollama            │
          │ llama.cpp         │
          │ OpenAI-compatible │
          └─────────┬─────────┘
                    │
              semantic plan
                    │
          ┌─────────▼─────────┐
          │    AERA Core      │
          │ permissions       │
          │ action journal    │
          └─────────┬─────────┘
                    │
                Skill Bus
                    │
          ┌─────────▼─────────┐
          │ validated Skill   │
          │ REAPER / future   │
          └─────────┬─────────┘
                    │
             native backend
```

Skills publish a planner capability catalog. The model only sees the semantic operations that installed Skills advertise. Future WAVR, Ableton, Unreal, Blender, and other integrations can therefore extend AERA without hardcoding their operations into the core planner.

## Interaction

| Interaction | Behavior |
|---|---|
| Click orb | wake/summon |
| Alt + drag | physically move AERA |
| Right click | open/close AERA controls |
| Global shortcut | summon and focus AERA |
| Text input | local conversation or semantic command |
| Microphone | record locally and transcribe through whisper.cpp |
| Studio | quiet, low-motion DAW presence |
| DND | minimal presence |
| Sleep | tiny low-energy depth state |

The attached control surface shows local **AI / MIC / VOICE / REAPER / OSC** health, installed models, rendering preferences, talk-back settings, conversation history, and runtime architecture.

## Quick start

Prerequisites:

- Node.js 22+
- stable Rust
- Tauri prerequisites for your OS

```bash
npm install
npm run check:local
npm run tauri dev
```

`check:local` probes the optional local AI and speech services and reports which ones are reachable.

AERA still launches when none are running.

## Local services

Default loopback endpoints:

| Service | Endpoint |
|---|---|
| Ollama | `127.0.0.1:11434` |
| llama.cpp | `127.0.0.1:8080` |
| whisper.cpp | `127.0.0.1:8081` |
| Piper | `127.0.0.1:5000` |
| REAPER OSC | `127.0.0.1:8000` |

For another local OpenAI-compatible server, set its `/v1` root:

```bash
export AERA_OPENAI_LOCAL_URL=http://127.0.0.1:8001/v1
```

See `docs/LOCAL_AI.md` for platform-specific setup.

## Verification

```bash
npm run typecheck
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

CI additionally packages:

- macOS arm64
- macOS x86_64 Intel
- Windows x64

## Safety boundary

AERA does **not** expose arbitrary shell execution to the model.

Current design:

```text
model proposes intent
       ↓
planner allowlist
       ↓
installed Skill lookup
       ↓
Skill validates input
       ↓
risk classification
       ↓
permission engine
       ↓
native execution
       ↓
journal
```

Destructive future operations must require confirmation. Reversible operations should provide undo whenever the target software allows it.

## Deliberately not claimed yet

These are still future work:

- always-listening wake word
- active third-party window geometry
- window occlusion avoidance using real external-window bounds
- screen/application visual inspection
- bidirectional REAPER state
- REAPER track/project inspection
- deeper DAW operations such as arm/mute/solo/parameters
- WAVR/Ableton/FL Studio/Pro Tools Skills
- Unreal/Blender Skills
- architecture-aware updater
- release signing and macOS notarization

Capabilities are added to this list only when they have a real backend.

## Repository map

```text
src/
  ai/             local model adapters + constrained planner
  audio/          earcons, voice capture, local speech bridge
  core/           runtime, permissions, preferences, Skill Bus
  orb/            renderer, personality state, spatial utilities
  platform/       typed native bridges
  skills/         installed first-party Skills

src-tauri/
  src/            native host, local AI/speech, desktop apps, OSC, position
  capabilities/   Tauri permissions
  icons/          app assets

skills/
  reaper/         Skill manifest

docs/
  ARCHITECTURE.md
  LOCAL_AI.md
  PLATFORM_SUPPORT.md
  REAPER_SKILL.md
```

The design rule remains simple:

> **The orb is the character. AERA Core is the intelligence boundary. Skills are its abilities. The desktop is its world.**
