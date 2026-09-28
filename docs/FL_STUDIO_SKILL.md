# AERA FL Studio Skill

AERA's FL Studio integration uses Image-Line's supported **MIDI Scripting Device API**. FL Studio executes the Python companion itself, and the API is bidirectional: controller scripts can call FL Studio features and receive state changes back. The official API exposes transport, mixer selection, mute/solo/arm, volume, pan, tempo, project title, and plugin-slot inspection.

## Install

From AERA's control panel press **Install** on the FL Bridge strip.

AERA writes:

```text
~/Documents/Image-Line/FL Studio/Settings/Hardware/AERA/device_AERA.py
```

Then in FL Studio:

1. Open **Options -> MIDI Settings**.
2. Enable any input port that AERA can occupy.
3. Set its **Controller type** to **AERA Local Bridge (user)**.

FL Studio loads the script itself. No external Python install is required.

## Local bridge protocol

The script and AERA communicate only through:

```text
~/.aera/bridges/flstudio/
  state.json
  commands/<id>.json
  acks/<id>.json
```

The bridge never executes arbitrary Python or shell commands.

AERA writes a semantic command such as:

```json
{
  "schemaVersion": 1,
  "id": "flstudio-track-mute-set-abc",
  "capability": "track.mute.set",
  "input": {
    "appId": "flstudio",
    "target": "selected",
    "value": true
  }
}
```

The companion validates the target/capability again, executes the matching Image-Line API call, then returns an acknowledgement containing newly observed FL Studio state.

## Implemented capabilities

- `transport.play`
- `transport.stop`
- `transport.record.toggle`
- `track.mute.set`
- `track.solo.set`
- `track.arm.set`
- `track.volume.set`
- `track.pan.set`

Track operations apply only to the currently selected FL Studio **Mixer track**. That target constraint is deliberate.

## Verified state

AERA receives:

- project title
- playing / recording state
- play position where supported
- current tempo
- selected Mixer track index/name
- mute / solo / arm state
- volume / pan
- detected insert FX names

The local model receives this state only when FL Studio is verified as the foreground DAW.
