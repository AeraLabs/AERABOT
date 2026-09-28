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
