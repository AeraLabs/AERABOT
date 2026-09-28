# REAPER Skill

REAPER is AERA's first proving-ground software Skill.

The goal is not to automate REAPER with brittle screen coordinates. The goal is to prove AERA's semantic capability architecture with real supported integration paths.

## Current capabilities

| Capability | Backend | Risk | Status |
|---|---|---:|---|
| `software.open` | native whitelisted launcher | safe | implemented |
| `transport.play` | REAPER OSC `/play` | safe | implemented |
| `transport.stop` | REAPER OSC `/stop` | safe | implemented |
| `transport.pause` | REAPER OSC `/pause` | safe | implemented |

The language model never receives executable paths or OSC addresses. It proposes semantic capability names and structured input. The REAPER Skill validates that proposal, creates a typed AERA action, assigns the risk class, and hands it to AERA Core.

```text
voice / text
   ↓
local model
   ↓
semantic plan
   ↓
Skill Bus
   ↓
REAPER Skill validation
   ↓
permission engine
   ↓
native launcher / OSC bridge
   ↓
journal + result
```

## Launch detection

AERA currently detects conventional REAPER install locations on macOS and Windows. Only the stable application ID `reaper` is accepted by the native launcher.

There is deliberately no arbitrary `process.open(path)` or shell-execution capability.

## OSC setup

OSC transport is disabled until the user opts in.

In REAPER, open:

```text
Options
  → Preferences
    → Control/OSC/Web
      → Add
        → OSC (Open Sound Control)
```

Configure REAPER to receive local OSC on a port. AERA defaults to `8000`.

Then enable the bridge before launching AERA.

macOS:

```bash
export AERA_REAPER_OSC_ENABLED=1
export AERA_REAPER_OSC_PORT=8000
npm run tauri dev
```

Windows PowerShell:

```powershell
$env:AERA_REAPER_OSC_ENABLED = "1"
$env:AERA_REAPER_OSC_PORT = "8000"
npm run tauri dev
```

AERA sends only to `127.0.0.1`. The native bridge contains a fixed allowlist for supported transport operations.

## Next REAPER layer

The read-only project/track bridge and bidirectional transport/state foundation are now implemented. The next expansion should remain semantic and undo-aware:

1. track arm/mute/solo through validated reversible actions
2. selected-track volume/pan with before/after journal values
3. track selection and navigation
4. FX bypass/preset inspection before any parameter mutation
5. explicit undo support for reversible DAW edits
6. recording only after a more explicit permission and file-creation policy is designed

AERA should not advertise a mutating capability until the corresponding backend is real and testable.


## Live project and track inspection

The repository now includes:

```text
skills/reaper/reascript/aera_bridge.lua
```

This is a read-only deferred Lua ReaScript. REAPER ships with embedded Lua support, so it does not require Python or another runtime. ReaScript's deferred mode is designed for scripts that react to changing playback/project state.

### Install the bridge

1. Open AERA's control panel while REAPER is installed.
2. Under **REAPER INSPECTION**, click **Install bridge file**. AERA copies the exact bundled script into REAPER's local `Scripts/AERA/` directory.
3. Open REAPER's Actions window.
4. Choose **ReaScript: Load...** and load `aera_bridge.lua`.
5. Run it. It remains active as a deferred script until stopped from REAPER's Actions menu.

AERA refuses to overwrite an existing bridge script when its contents differ from the bundled source, so local edits are never silently destroyed.

The script writes:

```text
<REAPER resource>/Scripts/AERA/aera-state.json
```

AERA reads that file locally. Nothing is sent to the network.

### Snapshot contents

The bridge currently publishes:

- REAPER version
- current project name/file
- REAPER project state-change counter
- playing / paused / recording state
- play and edit-cursor position
- project length
- current BPM
- track count
- per-track GUID and name
- selection state
- mute / solo
- record arm
- record monitoring
- volume / pan
- media-item count
- FX count
- folder depth
- selected-track insert FX names

The API backing these values is REAPER's own ReaScript interface: `GetPlayStateEx`, `GetPlayPositionEx`, `GetProjectStateChangeCount`, `CountTracks`, `GetTrackState`, `GetTrackName`, `TrackFX_GetCount`, and related calls.

### Privacy boundary

The full project file path remains in the local bridge snapshot because it is useful to future native project operations, but AERA's model-context formatter deliberately omits the path. When REAPER is foreground, the model receives only a compact verified summary such as project name, transport state, BPM, track count, and selected-track state.

### Bidirectional architecture

```text
                    AERA
                      │
         semantic command / response
                      │
       ┌──────────────┴──────────────┐
       │                             │
       ▼                             ▼
 REAPER OSC (write)          ReaScript snapshot (read)
 play / stop / pause         project / tracks / FX
       │                             │
       └──────────── REAPER ─────────┘
```

This is the first real bidirectional DAW integration: AERA can issue supported transport commands and independently verify/read REAPER's live project state.
