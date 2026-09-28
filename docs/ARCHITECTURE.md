# AERA Orb Architecture

## Product boundary

```text
Desktop Host (Tauri/Rust)
        │
        ├── Orb Renderer (Three.js)
        ├── Local AI + Speech Bridges
        ├── AERA Core (state, permissions, journal)
        ├── OS Bridge (position, monitors, known apps)
        └── Skill Bus
                │
                └── REAPER Skill / future software Skills
```

The renderer is not the intelligence. It observes `OrbState` and expresses real runtime state through scale, depth, energy, waveform motion, particles, light, and earcons.

## Native host

Rust/Tauri owns:

- transparent always-on-top desktop window
- physical window sizing
- monitor discovery
- architecture detection
- global summon shortcut
- persistent physical position
- whitelisted known-application operations
- local HTTP bridges
- loopback REAPER OSC
- future OS-specific window-awareness APIs

Platform-specific behavior belongs behind native modules instead of being scattered through the React layer.

## Spatial model

X/Y are real desktop coordinates. Z is simulated through six reusable depth zones and influences host diameter, renderer scale, opacity, detail, blur, motion amplitude, and visual energy.

The native host resizes with perceived depth so a tiny/background AERA does not leave a large invisible always-on-top rectangle over the user's workspace.

## Position persistence

The native host stores the orb's last physical desktop coordinates in AERA's application config directory.

At startup, coordinates are restored only when the saved point still falls on a currently connected monitor. If display topology changed, AERA keeps the safe startup placement rather than restoring off-screen.

Physical pixels are used so mixed-DPI and Retina/non-Retina layouts retain coordinate precision.

## State model

Current states:

`IDLE`, `AMBIENT`, `AWAKE`, `LISTENING`, `UNDERSTANDING`, `THINKING`, `ACTING`, `WAITING`, `SPEAKING`, `QUESTION`, `SUCCESS`, `WARNING`, `ERROR`, `SLEEPING`, `STUDIO`, `DND`.

State transitions are runtime events from AERA Core.

## Local intelligence boundary

AERA supports interchangeable local inference providers:

- Ollama
- llama.cpp
- explicitly configured loopback OpenAI-compatible server

The provider returns language/model output only. It has no native desktop authority.

The planner is generated from the capabilities advertised by installed Skills.

```text
installed Skills
      ↓
planner capability catalog
      ↓
local model
      ↓
candidate semantic action
      ↓
Skill validation
      ↓
permission engine
```

This means a new Skill can add model-visible capabilities without modifying the central planner.

## Permission architecture

Every external action becomes a `ProposedAction` classified as:

- safe
- reversible
- destructive

Destructive actions require confirmation. Executed/rejected actions enter the journal. Skills can later expose undo for reversible operations.

## Skill architecture

A Skill advertises:

- stable identity
- supported semantic capabilities
- planner-facing action descriptors
- platform support
- proposal/input validation
- execution implementation
- optional undo behavior

AERA Core never needs application-specific screen coordinates or arbitrary command strings.

## REAPER proving ground

REAPER currently proves two backend classes:

- whitelisted native app detection/launch
- fixed allowlist of loopback OSC transport operations

The model sees `software.open`, `transport.play`, `transport.stop`, and `transport.pause`, not implementation details such as executable paths or OSC addresses.

See `REAPER_SKILL.md`.

## Current real capabilities

Implemented:

- transparent native host
- Intel/Apple Silicon architecture detection
- dynamic physical orb sizing
- multi-monitor discovery
- persistent desktop position
- global summon shortcut
- realtime glass/energy renderer
- state-driven visual personality
- procedural earcons
- microphone PCM capture
- whisper.cpp STT bridge
- Piper TTS bridge
- Ollama model discovery/chat
- llama.cpp model discovery/chat
- generic loopback OpenAI-compatible model discovery/chat
- constrained Skill-generated planner
- risk classification
- action journal
- REAPER detection + launch
- REAPER play/stop/pause through optional loopback OSC
- reduced-motion support
- cross-platform packaging CI

Not claimed yet:

- wake word
- focused external-window geometry
- screen inspection
- bidirectional DAW state
- project/track inspection
- broader software Skills
