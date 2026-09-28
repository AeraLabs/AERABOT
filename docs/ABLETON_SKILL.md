# AERA Ableton Live Skill

AERA's Ableton integration uses the official **Max for Live Live API** and Live Object Model.

The bridge source is:

```text
skills/ableton/aera_live_bridge.js
```

## Setup

1. Launch AERA once and press **Prepare** on the Ableton Bridge strip.
2. In Ableton Live, create/open a Max for Live MIDI Effect or Audio Effect device.
3. Put `aera_live_bridge.js` beside that device.
4. Add:
   ```text
   js aera_live_bridge.js
   ```
5. Add `live.thisdevice` and connect its left outlet to the `js` object.
6. Save the device and keep one instance loaded in the Live Set.

The `live.thisdevice` initialization bang starts AERA's polling task only after the Max for Live device is ready.

## Local protocol

```text
~/.aera/bridges/ableton/
  state.json
  commands/<id>.json
  acks/<id>.json
```

The Max companion opens no network socket. AERA Core validates:

- DAW identity
- command ID
- semantic capability
- selected-track targeting
- value range
- bridge freshness
- the companion's advertised capability list

before a command is written.

## Implemented capabilities

- `transport.play`
- `transport.stop`
- `transport.record.toggle`
- `track.mute.set`
- `track.solo.set`
- `track.arm.set`
- `track.volume.set`
- `track.pan.set`

Mute, solo, arm, volume, and pan capture previous verified state and are journaled as reversible AERA actions.

## Verified state

The companion publishes:

- Live Set name
- playing / Arrangement Record state
- current song position in beats
- tempo
- selected track identity
- mute / solo / arm
- normalized volume / pan
- selected-track device names

AERA only adds this detailed session state to the local model while Ableton is the verified foreground DAW.

## Why Max for Live

Ableton's Live API exposes the Live Object Model from Max for Live. The JavaScript `LiveAPI` object can get/set properties and call functions, while `File`, `Folder`, and `Task` provide the local bridge and scheduling primitives needed by AERA. This gives AERA structured state and control without pixel clicking or arbitrary shell access.
