# AERA Core DAW Skills

AERA's core DAW target set is:

- REAPER
- FL Studio
- Pro Tools
- Logic Pro
- Ableton Live
- WAVR (AeraLabs; separate first-party integration)

REAPER is the **reference implementation**, not the exclusive DAW.

The normalized AERA capability vocabulary is shared, but each DAW gets the strongest backend the vendor actually supports.

| DAW | Platforms | Phase 1 | Deep integration path |
|---|---|---|---|
| REAPER | macOS + Windows | detect, launch, OSC transport, live project/track inspection | OSC + ReaScript |
| FL Studio | macOS + Windows | detect + launch | Image-Line Python MIDI Scripting Device API + AERA virtual MIDI bridge |
| Pro Tools | macOS + Windows | detect + launch | Avid Pro Tools Scripting SDK (gRPC/Protocol Buffers) |
| Logic Pro | macOS | detect + launch | Logic Control Surfaces, OSC/UDP, Lua controller scripting |
| Ableton Live | macOS + Windows | detect + launch | Max for Live Live API / Live Object Model + control-surface integration |

## Why the adapters differ

AERA should expose one semantic vocabulary:

```text
software.open
transport.play
transport.stop
transport.pause
transport.record
track.select
track.arm
track.mute
track.solo
track.volume.set
track.pan.set
project.inspect
session.save
```

But the implementation must not pretend every DAW has the same API.

### FL Studio

Image-Line documents a native MIDI Scripting Device API. FL Studio executes Python controller scripts itself and the communication is bidirectional: scripts can call FL Studio features and FL Studio can send state back to the controller.

AERA's intended bridge:

```text
AERA Skill
   ↕
local virtual MIDI port
   ↕
AERA FL Studio Python device script
   ↕
FL Studio MIDI Scripting API
```

This keeps AERA on FL Studio's supported controller layer and avoids brittle pixel automation.

Official reference:
https://www.image-line.com/fl-studio-learning/fl-studio-online-manual/html/midi_scripting.htm

### Pro Tools

Avid's Pro Tools Scripting SDK is the strongest external automation API in this group. Avid describes it as a free, open, language-independent API using inter-process communication; clients can query sessions/playback/clips and execute writable commands. It is available on macOS and Windows.

AERA's intended bridge:

```text
AERA Pro Tools Skill
   ↕
gRPC / Protocol Buffers
   ↕
Avid Scripting SDK
   ↕
Pro Tools
```

This should become a first-class native adapter rather than MIDI emulation.

Official references:
https://www.avid.com/resource-center/pro-tools-scripting-sdk
https://kb.avid.com/pkb/articles/en_US/Knowledge/Pro-Tools-Scripting-SDK-FAQ

### Logic Pro

Logic's supported control-surface system includes bidirectional controller communication, Lua-supported controller assignments, MIDI/MMC, and OSC assignments. Apple's current documentation states that Logic's OSC implementation uses UDP/IPv4.

AERA's intended bridge:

```text
AERA Logic Skill
   ↕
loopback OSC / virtual MIDI
   ↕
AERA Logic control-surface profile
   ↕
Logic Pro
```

Logic is macOS-only. The AERA Skill must work on both Intel and Apple Silicon Macs; no Apple-Silicon-only shortcut is acceptable.

Official references:
https://support.apple.com/guide/logicpro-css/welcome/mac
https://support.apple.com/guide/logicpro/automatic-assignment-for-usb-midi-controllers-ctlsbfee6d57/mac
https://support.apple.com/guide/logicpro/ctlsf67f4bdc/mac

### Ableton Live

Ableton's official Max for Live API exposes the Live Object Model: application, Song, Tracks, Clips, Devices, parameters, mixer state, scenes, cue points, and control surfaces. It supports querying, setting properties, calling functions, and observing state.

AERA's intended bridge:

```text
AERA Ableton Skill
   ↕
local companion channel
   ↕
AERA Max for Live device
   ↕
Live API / Live Object Model
```

AERA can also use control-surface scripts for controller-style behavior, but Max for Live is the better structured path for deep bidirectional session state where available.

Official references:
https://help.ableton.com/hc/en-us/articles/5402681764242-Controlling-Live-using-Max-for-Live
https://www.ableton.com/en/manual/max-for-live/
https://help.ableton.com/hc/en-us/articles/206240184-Creating-your-own-Control-Surface-script

## Delivery rule

No DAW is marked as supporting a semantic capability merely because AERA can press a keyboard shortcut or click a coordinate.

A capability enters the manifest only when:

1. there is a real backend,
2. input is validated,
3. state/result can be verified where the DAW exposes it,
4. risk class is explicit,
5. failure is reported honestly,
6. Intel Mac remains supported wherever that DAW supports Intel.

The initial multi-DAW phase implements safe install detection and launch for all five DAWs while deeper adapters are built independently.
