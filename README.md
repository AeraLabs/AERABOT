# AERA Orb Desktop Runtime

AERA Orb is the local-first desktop companion runtime for AERA: a native transparent desktop presence, realtime 3D orb renderer, spatial behavior layer, local command core, permission journal, and extensible software Skill bus.

AERA is intentionally split into **character, intelligence, and abilities**:

- the **Orb** is the visual/audio character
- **AERA Core** owns commands, state, permissions, actions, and history
- **Skills** will translate semantic AERA capabilities into real software integrations
- the **native host** owns desktop-level behavior and OS integration

The renderer never pretends to be the intelligence, and unsupported application actions are never faked.

## Supported targets

- **macOS Apple Silicon** — arm64
- **macOS Intel** — x86_64, mandatory release target
- **Windows 10/11** — x86_64

CI builds each native architecture independently so one passing platform cannot hide a failure on another.

## Current interaction

| Interaction | Behavior |
|---|---|
| Click orb | Wake/summon AERA, then enter listening state |
| Alt + drag | Move the native orb window |
| Right click | Open/close the attached AERA control surface |
| Text command | Route an internal command through AERA Core |
| Studio | Quiet, small-footprint DAW-oriented state |
| DND | Minimal movement and presence |
| Sleep | Retreat into a tiny low-energy state |

The attached control surface currently exposes:

- text command entry
- Ambient / Listening / Thinking / Studio / DND / Sleep modes
- Auto / Ultra / High / Balanced / Efficiency graphics profiles
- System / Reduced / Full motion preferences
- earcon enable/disable
- runtime platform + architecture + AI capability profile

Preferences persist locally.

## Architecture

```text
                    AERA ORB
                       │
               ┌───────┴────────┐
               │ Native Host    │
               │ Tauri + Rust   │
               └───────┬────────┘
                       │
        ┌──────────────┼────────────────┐
        │              │                │
        ▼              ▼                ▼
   Orb Renderer     AERA Core        OS Bridge
   Three.js         commands         monitors
   shaders          actions          position
   motion           journal          sizing
   earcons          permissions       platform
        │              │                │
        └──────────────┼────────────────┘
                       ▼
                    Skill Bus
                       │
             future real integrations
```

### Native host

Tauri v2 + Rust owns:

- transparent frameless presentation
- always-on-top desktop presence
- architecture detection
- physical grow/shrink behavior
- native dragging
- click-through capability
- monitor discovery and DPI information
- future external-window observation and OS-specific bridges

### Orb runtime

Three.js currently provides:

- translucent physical-material shell
- restrained white / silver / mint / blue material language
- internal animated energy shader
- waveform ring
- particles
- pointer-reactive body language
- state-specific scale, energy, motion, glow, opacity, and detail
- reduced-motion support
- efficiency-oriented rendering path

### AERA Core

The TypeScript runtime currently provides:

- event-driven OrbState transitions
- internal command routing
- semantic Skill registry
- proposed-action model
- safe / reversible / destructive action classification
- confirmation requirement for destructive actions
- action journal foundation
- explicit refusal to fake unavailable capabilities

### Audio language

Earcons are synthesized procedurally through WebAudio rather than depending on bundled samples. Wake, listening, understanding, thinking, acting, success, question, warning, error, and sleep states have distinct patterns.

## What is real today

Implemented in the repository:

- native transparent desktop host
- macOS Intel architecture target
- macOS Apple Silicon architecture target
- Windows x64 architecture target
- dynamic native orb sizing
- architecture + capability detection
- multi-monitor enumeration
- realtime crystal/energy orb
- visual personality state machine
- procedural earcons
- attached command/settings surface
- persistent local preferences
- permission/risk model
- action journal
- Skill bus interface
- spatial placement utilities
- reduced-motion support
- frontend unit tests
- independent cross-platform GitHub Actions packaging

## Deliberately not faked yet

These remain next-stage integrations and should only be marked complete when backed by real native/runtime capability:

- wake-word engine
- speech recognition
- local LLM inference
- local text-to-speech
- external application control
- active external-window geometry
- screen/application inspection
- DAW automation Skills
- architecture-aware updater
- code signing / macOS notarization

## Development

Prerequisites:

- Node.js 22+
- current stable Rust toolchain
- Tauri platform prerequisites for the host OS

```bash
npm install
npm run tauri dev
```

Frontend verification:

```bash
npm run typecheck
npm test
npm run build
```

Native verification:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

## Repository map

```text
src/
  audio/          procedural AERA earcons
  core/           runtime, permissions, journal, preferences, Skill bus
  orb/            renderer, state model, spatial utilities
  platform/       frontend/native bridge

src-tauri/
  src/            native desktop host commands
  capabilities/   Tauri security capabilities
  icons/          app assets
  tauri.conf.json desktop packaging/window configuration

docs/
  ARCHITECTURE.md
  PLATFORM_SUPPORT.md
```

See `docs/ARCHITECTURE.md` and `docs/PLATFORM_SUPPORT.md` for engineering boundaries and platform rules.
