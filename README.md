# AERA Orb Desktop Runtime

AERA Orb is the local-first desktop intelligence runtime for AERA: a living transparent 3D orb, local voice/chat system, permissioned action engine, and extensible Skill platform for controlling creative software.

The product is intentionally divided into four boundaries:

- **Orb** — character, motion, light, sound, and desktop presence
- **AERA Core** — state, commands, permissions, execution, and journal
- **Local Intelligence** — interchangeable local model/speech runtimes
- **Skills** — validated semantic abilities for real software

A model is never treated as proof that an action happened. Real computer actions must pass through an installed Skill and AERA Core.

## Current downloads

**AERA Orb 0.1.0 · Build 111 · source `ab58bde` · September 28, 2026**

All three binaries below were produced from the **same current `main` source commit** and passed the complete GitHub Actions build for Build 111: frontend typecheck/tests/build, native Rust tests, branded native icon generation/verification, and platform packaging. The macOS jobs also passed the runtime-linkage check added after the Intel Swift-runtime launch failure. These are development builds; signing, macOS notarization, and the production updater are not finished yet.

> **Build 111 status:** these downloads include the current persistent local action journal, explicit opt-in one-shot foreground visual context, the latest DAW integration work, the Intel macOS Swift-runtime linker fix, and the new branded AERA application icon assets present in `main` at source `ab58bde`.

| Platform | Architecture | Current build | Build verification |
|---|---|---|---|
| **macOS — Apple Silicon** | M1 / M2 / M3 / M4+ · `aarch64-apple-darwin` | **[Download Apple Silicon build](https://github.com/CLIdaho/AERABOT/actions/runs/36515358563/artifacts/11011185924)** | ✅ Build 111 · `AERA Orb_0.1.0_aarch64.dmg` + `.app` |
| **macOS — Intel** | Intel x86_64 · `x86_64-apple-darwin` | **[Download Intel Mac build](https://github.com/CLIdaho/AERABOT/actions/runs/36515358563/artifacts/11010829341)** | ✅ Build 111 · `AERA Orb_0.1.0_x64.dmg` + `.app` · Swift runtime linkage verified |
| **Windows 10/11** | x64 · `x86_64-pc-windows-msvc` | **[Download Windows x64 build](https://github.com/CLIdaho/AERABOT/actions/runs/36515358563/artifacts/11010834608)** | ✅ Build 111 · `.msi` + setup `.exe` |

**Full build run:** [AERA Desktop Builds #111](https://github.com/CLIdaho/AERABOT/actions/runs/36515358563)

> GitHub Actions artifacts are ZIP downloads and currently expire on **December 28, 2026**. For a private repository, GitHub sign-in with repository access is required. A future signed release channel will replace these temporary artifact links.
> **Intel Mac note:** Build 111 is compiled and packaged on GitHub's dedicated `macos-15-intel` runner as a real `x86_64-apple-darwin` target. It includes the fix for the Build 105 `@rpath/libswiftCore.dylib` / missing `LC_RPATH` launch failure, and CI now inspects the finished Mach-O runtime linkage before upload. Use the x64 DMG above on Intel Macs. Because the app is still unsigned/unnotarized, macOS may still require **Open Anyway** on first launch; CI verification is not a substitute for physical-hardware soak testing.


### Platform status — what works today

Legend: **✅ working**, **◐ working with setup / partial backend**, **— not applicable**, **⏳ not finished**.

| Capability | Apple Silicon macOS | Intel macOS | Windows x64 | Current reality |
|---|:---:|:---:|:---:|---|
| Native transparent AERA orb | ✅ | ✅ | ✅ | Frameless native host, realtime orb renderer, grow/shrink and desktop presence |
| Multi-monitor + persistent position | ✅ | ✅ | ✅ | DPI-aware monitor enumeration and saved position |
| Global summon | ✅ | ✅ | ✅ | **Cmd+Shift+Space** on macOS; **Ctrl+Shift+Space** on Windows |
| Foreground application detection | ✅ | ✅ | ✅ | Native focused-app identity |
| Focused-window geometry | ◐ | ◐ | ✅ | macOS requires explicit Accessibility permission; Windows uses native geometry |
| Window-aware spatial movement | ◐ | ◐ | ✅ | Uses verified foreground geometry; macOS depends on Accessibility permission |
| First-run Skill Manager | ✅ | ✅ | ✅ | Detects local AI, voice, wake word, window access and DAW bridge readiness |
| Ollama / llama.cpp / local OpenAI-compatible AI | ✅ | ✅ | ✅ | Local-only adapters; the external local runtime/model must be installed and running |
| whisper.cpp speech-to-text | ◐ | ◐ | ◐ | Works through the configured local whisper service |
| Piper talk-back | ◐ | ◐ | ◐ | Works through the configured local Piper service; text/earcons remain available without it |
| Wake phrase → listen → transcribe → action → reply | ◐ | ◐ | ◐ | End-to-end flow is wired; requires the local wake companion/model and whisper service |
| REAPER Skill | ✅ | ✅ | ✅ | Verified project/transport/track state plus real control and undo-backed actions where supported |
| FL Studio Skill | ◐ | ◐ | ◐ | Deep MIDI Scripting bridge exists; user still selects the AERA controller script in FL Studio |
| Ableton Live Skill | ◐ | ◐ | ◐ | Live/Max-for-Live companion exists; Max-for-Live bridge setup is still required |
| Logic Pro Skill | ◐ | ◐ | — | macOS-only OSC/controller-assignment bridge; controller setup is not fully automatic yet |
| Pro Tools Skill | ◐ | ◐ | ◐ | AERA PTSL wrapper/contract exists; the Avid SDK helper still needs completion/build integration |
| **WAVR first-party Skill** | ✅ | ✅ | ✅ | Native AeraLabs bridge with verified project/transport/full-track state, pause/seek/tempo, track selection, mute/solo/arm, volume/pan, FX inspection and undo where prior state is captured |
| Opt-in screen / visual context | ◐ | ◐ | ◐ | Build 111 includes explicit session-scoped one-shot foreground capture; broader continuous/context-aware modes are not finished |
| Signed installers | ⏳ | ⏳ | ⏳ | Current artifacts are development packages |
| macOS notarization | ⏳ | ⏳ | — | Not finished |
| Automatic updater | ⏳ | ⏳ | ⏳ | Architecture-aware production update channel not finished |
| Long-session / hardware soak certification | ⏳ | ⏳ | ⏳ | CI package success is **not** being presented as a physical-machine soak test |

### Verification level

Build 111 is **package-verified** on Apple Silicon, Intel x86_64, and Windows x64 through independent CI jobs. That proves the targets compile, test, generate/verify their native application icons, and package successfully. The two macOS jobs additionally passed the Swift runtime-linkage check.

It does **not** yet mean every build has completed a long-duration launch/audio/DAW test on physical hardware. In particular, **Intel Mac remains a mandatory target**, but the current README intentionally distinguishes successful Intel packaging from a real Intel-hardware soak test.

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
- foreground application identity on macOS and Windows
- real focused-window geometry (Windows natively; macOS after explicit Accessibility consent)
- window-aware spatial placement with multi-monitor/DPI conversion and jitter suppression
- automatic quiet-corner retreat for fullscreen/high-coverage workspaces
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

AERA also has an optional fully local wake-word companion. The runtime does not bundle wake-word model weights; users choose a model whose license fits their use case.

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

The reference external software Skill is **REAPER**. The core third-party DAW set also includes **FL Studio, Pro Tools, Logic Pro, and Ableton Live**, while **WAVR is now the deepest first-party AERA Skill** because AeraLabs controls both ends of the bridge.

Implemented:

- detect and safely launch REAPER
- detect and safely launch FL Studio
- detect and safely launch Pro Tools
- detect and safely launch Logic Pro on macOS
- detect and safely launch Ableton Live
- launch DAWs through a whitelisted native application bridge
- play transport through loopback OSC
- stop transport through loopback OSC
- pause transport through loopback OSC
- read live REAPER project/transport/track state through a read-only Lua ReaScript
- expose verified selected-track context to the local model while REAPER is foreground
- deep FL Studio control through its Python MIDI Scripting API companion
- deep Ableton control through the Max for Live / Live API companion
- Logic Pro deep-control Skill plus verified loopback OSC companion
- Pro Tools deep-control Skill plus an Avid SDK-helper wrapper contract
- optional local wake-word companion with cooldown/deduplicated events
- first-run Skill Manager with verified readiness states rather than simple installed/not-installed flags
- unified wake phrase → listening → local transcription → response/action → talk-back flow
- first-party WAVR bridge with verified full-track/project context, transport, seek, tempo, track selection, mixer controls, FX inspection, and reversible state capture where available
- persistent local action journal with restart-safe history and undo state

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
          │ REAPER / WAVR /…  │
          └─────────┬─────────┘
                    │
             native backend
```

Skills publish a planner capability catalog. The model only sees the semantic operations that installed Skills advertise. WAVR, Ableton, and the other current DAW integrations extend AERA through the same Skill boundary; future Unreal, Blender, and other integrations can do the same without hardcoding their operations into the core planner.

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

The attached control surface shows local **AI / MIC / VOICE / DAW / WAKE** health, installed models, rendering preferences, talk-back settings, conversation history, runtime architecture, and a reopenable **SETUP** entry for the first-run Skill Manager.

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

- bundled/licensed wake-word model distribution
- broader continuous/application visual-context modes beyond the current explicit one-shot foreground capture
- automatic generation/building of Avid Pro Tools SDK helper artifacts
- automatic Logic Controller Assignment provisioning
- full capability parity across every third-party DAW
- Unreal/Blender Skills
- architecture-aware updater
- release signing and macOS notarization
- physical Intel Mac / Apple Silicon / Windows long-session soak certification

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
  reaper/         REAPER manifest + ReaScript bridge
  flstudio/       FL Studio Skill manifest
  protools/       Pro Tools Skill manifest
  logic/          Logic Pro Skill manifest
  ableton/        Ableton Live Skill manifest

docs/
  ARCHITECTURE.md
  LOCAL_AI.md
  PLATFORM_SUPPORT.md
  REAPER_SKILL.md
  DAW_SKILLS.md
  LOGIC_SKILL.md
  PROTOOLS_SKILL.md
```

The design rule remains simple:

> **The orb is the character. AERA Core is the intelligence boundary. Skills are its abilities. The desktop is its world.**
