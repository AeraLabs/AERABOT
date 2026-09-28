# AERA Orb Architecture

## Product boundary

```text
Desktop Host (Tauri/Rust)
        |
        +---- Orb Renderer (Three.js)
        +---- AERA Core (commands, actions, journal)
        +---- OS Bridge (position, monitors, windows)
        +---- Skill Bus (future software integrations)
```

The renderer is intentionally not the intelligence. It observes `OrbState` and expresses state through scale, energy, waveform motion, particles, light, and earcons.

## Native host

Rust/Tauri owns the transparent always-on-top desktop window, physical window sizing, monitor discovery, architecture detection, and future OS-specific bridges. Platform-specific APIs belong behind native modules instead of leaking checks throughout the product.

## Spatial model

X/Y represent desktop position. Z is simulated through six depth zones and influences physical host diameter, renderer scale, opacity, detail, motion amplitude, and energy.

The native window resizes as AERA changes perceived depth. That keeps the transparent hit target close to the visible orb rather than placing a large invisible always-on-top rectangle over the user's work.

## State model

Initial states: IDLE, AMBIENT, AWAKE, LISTENING, UNDERSTANDING, THINKING, ACTING, WAITING, SPEAKING, QUESTION, SUCCESS, WARNING, ERROR, SLEEPING, STUDIO, DND.

State transitions are runtime events from AERA Core. The renderer does not invent thinking or acting with fake timers.

## Permission architecture

Every external software action becomes a `ProposedAction`: safe, reversible, or destructive. Destructive actions require confirmation. Execution is journaled. Future Skills can expose undo for reversible operations.

## Skill architecture

Skills advertise semantic capabilities such as `transport.play`, `track.arm`, `parameter.set`, and `project.inspect`. AERA Core reasons about capabilities. Skills translate them into native APIs, plugins, scripting, RPC, MIDI/OSC, accessibility, or lower-priority automation.

## Current status

Implemented:
- transparent native host
- runtime architecture detection
- dynamic physical orb sizing
- monitor discovery
- realtime glass/energy renderer
- state-driven visual personality
- procedural earcons
- permission classification
- action journal
- Skill bus contract
- reduced-motion support
- spatial placement utilities
- Intel/Apple Silicon/Windows build targets

Intentionally not faked yet:
- wake word
- speech recognition
- LLM inference
- application control
- focused-window geometry
- DAW Skills
- screen inspection


## Desktop position persistence

The native host stores the orb's last physical desktop coordinates in AERA's application config directory. On startup the saved coordinates are restored only when they still land on a currently connected display. If the monitor has been disconnected or the topology has changed, AERA leaves Tauri's safe startup placement intact rather than restoring itself off-screen.

Position persistence uses physical pixels so mixed-DPI and Retina/non-Retina monitor arrangements do not lose coordinate precision during native dragging.
