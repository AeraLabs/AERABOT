# AERA Pro Tools Skill

AERA targets Avid's official Pro Tools Scripting SDK for deep integration.

Avid describes the SDK as an inter-process API available on macOS and Windows, usable from languages supported by gRPC and Protocol Buffers. It can query open sessions, playback state and clips, and perform writable actions.

## Why AERA does not bundle an SDK client

The AERA repository does not guess or redistribute Avid-generated SDK artifacts. Instead it defines a small local helper boundary:

```text
AERA Core
   ↓ semantic action
Pro Tools Skill
   ↓ ~/.aera/bridges/protools/commands
aera_ptsl_bridge.py
   ↓ JSON helper contract
local PTSL helper
   ↓ Avid gRPC / Protocol Buffers
Pro Tools
```

AERA installs:

```text
~/.aera/bridges/protools/aera_ptsl_bridge.py
```

Run it with a helper executable that was built against the official SDK:

```bash
python ~/.aera/bridges/protools/aera_ptsl_bridge.py --helper /path/to/aera-ptsl-helper
```

## Helper contract

Snapshot:

```text
aera-ptsl-helper snapshot
```

must print JSON containing:

```json
{
  "projectName": "Session",
  "transport": {
    "playing": false,
    "recording": false,
    "positionSeconds": 12.4,
    "bpm": 120
  },
  "selectedTrack": {
    "id": "track-id",
    "index": 4,
    "name": "Lead Vocal",
    "muted": false,
    "soloed": false,
    "armed": true,
    "volume": 0.8,
    "pan": 0,
    "fx": []
  },
  "capabilities": ["transport.play", "transport.stop"]
}
```

Command:

```text
aera-ptsl-helper command <capability> <json-input>
```

must return:

```json
{"ok": true, "result": {}}
```

or:

```json
{"ok": false, "error": "reason"}
```

AERA will not propose or execute deep Pro Tools capabilities unless the live helper snapshot explicitly advertises them.

Official reference:
- https://kb.avid.com/pkb/articles/en_US/Knowledge/Pro-Tools-Scripting-SDK-FAQ
