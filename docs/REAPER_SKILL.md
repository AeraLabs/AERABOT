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

The next meaningful expansion should use REAPER's stronger integration surfaces rather than mouse automation:

1. bidirectional OSC state for transport and selected-track feedback
2. ReaScript companion for project/track inspection
3. track arm/mute/solo through validated semantic actions
4. selected-track volume/pan
5. undo-aware reversible parameter changes
6. project metadata inspection
7. recording only after a more explicit permission and file-creation policy is designed

AERA should not advertise a capability until the corresponding backend is real and testable.


## Live project and track inspection

The repository now includes:

```text
skills/reaper/reascript/aera_bridge.lua
```

This is a read-only deferred Lua ReaScript. REAPER ships with embedded Lua support, so it does not require Python or another runtime. ReaScript's deferred mode is designed for scripts that react to changing playback/project state. citeturn214787search1

### Install the bridge

1. In REAPER open **Options -> Show REAPER resource path in explorer/finder**.
2. Open the `Scripts` directory.
3. Copy `aera_bridge.lua` into `Scripts/AERA/`.
4. Open REAPER's Actions window.
5. Choose **ReaScript: Load...** and load the script.
6. Run it. It remains active as a deferred script until stopped from REAPER's Actions menu.

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

The API backing these values is REAPER's own ReaScript interface: `GetPlayStateEx`, `GetPlayPositionEx`, `GetProjectStateChangeCount`, `CountTracks`, `GetTrackState`, `GetTrackName`, `TrackFX_GetCount`, and related calls. citeturn953479search1turn220183search0

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
