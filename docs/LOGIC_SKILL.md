# AERA Logic Pro Skill

Logic Pro is controlled through Apple's supported Control Surfaces / Controller Assignments layer rather than pixel automation.

Apple documents controller assignments for MIDI and OSC devices, including an OSC tab for paths and feedback, and states that Logic's OSC implementation uses UDP/IPv4. Apple also documents Lua-backed automatic assignments for supported MIDI controller profiles.

## AERA architecture

```text
AERA Core
   ↓ validated semantic action
Logic Skill
   ↓ ~/.aera/bridges/logic/commands
aera_logic_osc.py
   ↓ loopback UDP OSC
Logic Controller Assignment
   ↓ feedback OSC
aera_logic_osc.py
   ↓ verified state + ack
AERA Core
```

AERA installs the companion into:

```text
~/.aera/bridges/logic/aera_logic_osc.py
```

Default ports:

- AERA sends to Logic on `127.0.0.1:9000`
- AERA listens for Logic feedback on `127.0.0.1:9001`

Both are configurable when launching the companion.

## Command paths

Map these incoming OSC paths in Logic Controller Assignments:

- `/aera/transport/play`
- `/aera/transport/stop`
- `/aera/transport/record`
- `/aera/track/mute`
- `/aera/track/solo`
- `/aera/track/arm`
- `/aera/track/volume`
- `/aera/track/pan`

## Feedback paths

Configure Logic feedback to the companion's listen port using:

- `/aera/state/transport/play`
- `/aera/state/transport/record`
- `/aera/state/transport/position`
- `/aera/state/bpm`
- `/aera/state/project/name`
- `/aera/state/track/index`
- `/aera/state/track/name`
- `/aera/state/track/mute`
- `/aera/state/track/solo`
- `/aera/state/track/arm`
- `/aera/state/track/volume`
- `/aera/state/track/pan`
- `/aera/state/track/fx`

The companion does **not** acknowledge a command merely because an OSC packet was sent. It waits for matching feedback and returns an error when Logic does not confirm the requested state.

Official references:
- https://support.apple.com/guide/logicpro/controller-assignments-overview-ctls71c31487/mac
- https://support.apple.com/guide/logicpro/ctlsf67f4bdc/mac
- https://support.apple.com/guide/logicpro/automatic-assignment-for-usb-midi-controllers-ctlsbfee6d57/mac
