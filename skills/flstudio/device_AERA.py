# name=AERA Local Bridge
# AERA local-only FL Studio companion.
# It publishes verified state to ~/.aera/bridges/flstudio and consumes only
# a fixed set of AERA semantic commands from that same local directory.

import os
import json
import time

import transport
import mixer
import general
import plugins

SCHEMA_VERSION = 1
BRIDGE_VERSION = "0.1.0"
ROOT = os.path.join(os.path.expanduser("~"), ".aera", "bridges", "flstudio")
COMMANDS = os.path.join(ROOT, "commands")
ACKS = os.path.join(ROOT, "acks")
STATE = os.path.join(ROOT, "state.json")
STATE_TMP = os.path.join(ROOT, "state.tmp")
WRITE_INTERVAL = 0.20
MAX_FX = 10

CAPABILITIES = [
    "transport.play",
    "transport.stop",
    "transport.record.toggle",
    "track.mute.set",
    "track.solo.set",
    "track.arm.set",
    "track.volume.set",
    "track.pan.set",
]

_last_write = 0.0

def _mkdir(path):
    try:
        os.makedirs(path, exist_ok=True)
    except TypeError:
        if not os.path.isdir(path):
            os.makedirs(path)

def _atomic_json(path, value):
    parent = os.path.dirname(path)
    _mkdir(parent)
    temp = path + ".tmp"
    with open(temp, "w") as handle:
        json.dump(value, handle, separators=(",", ":"))
        handle.flush()
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
    os.rename(temp, path)

def _safe(callable_value, fallback=None):
    try:
        return callable_value()
    except Exception:
        return fallback

def _selected_track():
    index = _safe(lambda: int(mixer.trackNumber()), 0)
    name = _safe(lambda: mixer.getTrackName(index), "Mixer " + str(index))
    fx = []
    for slot in range(MAX_FX):
        valid = _safe(lambda slot=slot: bool(mixer.isTrackPluginValid(index, slot)), False)
        if not valid:
            continue
        plugin_name = _safe(
            lambda slot=slot: plugins.getPluginName(index, slot),
            "",
        )
        if plugin_name:
            fx.append(str(plugin_name))

    return {
        "id": "mixer:" + str(index),
        "index": index,
        "name": str(name),
        "muted": bool(_safe(lambda: mixer.isTrackMuted(index), False)),
        "soloed": bool(_safe(lambda: mixer.isTrackSolo(index), False)),
        "armed": bool(_safe(lambda: mixer.isTrackArmed(index), False)),
        "volume": float(_safe(lambda: mixer.getTrackVolume(index), 0.0)),
        "pan": float(_safe(lambda: mixer.getTrackPan(index), 0.0)),
        "fx": fx,
    }

def _project_title():
    title = _safe(lambda: general.getProjectTitle(), None)
    return str(title) if title else None

def _tempo():
    tempo = _safe(lambda: mixer.getCurrentTempo(), None)
    if tempo is None:
        return None
    try:
        value = float(tempo)
        # Some API versions may expose scaled integer tempo.
        if value > 1000.0:
            value = value / 1000.0
        return value
    except Exception:
        return None

def _position_seconds():
    value = _safe(lambda: transport.getSongPos(1), None)
    try:
        return float(value) if value is not None else None
    except Exception:
        return None

def _snapshot():
    return {
        "schemaVersion": SCHEMA_VERSION,
        "dawId": "flstudio",
        "bridgeVersion": BRIDGE_VERSION,
        "projectName": _project_title(),
        "transport": {
            "playing": bool(_safe(lambda: transport.isPlaying(), False)),
            "recording": bool(_safe(lambda: transport.isRecording(), False)),
            "positionSeconds": _position_seconds(),
            "bpm": _tempo(),
        },
        "selectedTrack": _selected_track(),
        "capabilities": CAPABILITIES,
    }

def _ack(command_id, capability, ok, result=None, error=None):
    payload = {
        "id": command_id,
        "ok": bool(ok),
        "capability": capability,
        "result": result,
        "error": error,
    }
    _atomic_json(os.path.join(ACKS, command_id + ".json"), payload)

def _desired_bool(command):
    value = command.get("input", {}).get("value")
    return value if isinstance(value, bool) else None

def _selected_index():
    return int(_safe(lambda: mixer.trackNumber(), 0))

def _execute(command):
    command_id = str(command.get("id", ""))
    capability = str(command.get("capability", ""))
    payload = command.get("input", {})
    if command.get("schemaVersion") != SCHEMA_VERSION:
        raise Exception("Unsupported AERA bridge schema.")
    if payload.get("appId") != "flstudio":
        raise Exception("Command target is not FL Studio.")

    if capability == "transport.play":
        transport.start()
    elif capability == "transport.stop":
        transport.stop()
    elif capability == "transport.record.toggle":
        transport.record()
    elif capability in ("track.mute.set", "track.solo.set", "track.arm.set"):
        if payload.get("target") != "selected":
            raise Exception("Only the selected mixer track can be changed.")
        desired = _desired_bool(command)
        if desired is None:
            raise Exception("Track state requires a boolean value.")
        index = _selected_index()
        if capability == "track.mute.set":
            mixer.muteTrack(index, 1 if desired else 0)
        elif capability == "track.solo.set":
            mixer.soloTrack(index, 1 if desired else 0)
        else:
            current = bool(mixer.isTrackArmed(index))
            if current != desired:
                mixer.armTrack(index)
    elif capability == "track.volume.set":
        if payload.get("target") != "selected":
            raise Exception("Only the selected mixer track can be changed.")
        value = float(payload.get("value"))
        if value < 0.0 or value > 1.0:
            raise Exception("Volume must be between 0 and 1.")
        mixer.setTrackVolume(_selected_index(), value)
    elif capability == "track.pan.set":
        if payload.get("target") != "selected":
            raise Exception("Only the selected mixer track can be changed.")
        value = float(payload.get("value"))
        if value < -1.0 or value > 1.0:
            raise Exception("Pan must be between -1 and 1.")
        mixer.setTrackPan(_selected_index(), value)
    else:
        raise Exception("Unsupported AERA capability.")

    return _snapshot()

def _process_commands():
    try:
        names = sorted(
            name for name in os.listdir(COMMANDS)
            if name.endswith(".json")
        )
    except Exception:
        return

    for name in names[:8]:
        path = os.path.join(COMMANDS, name)
        command = None
        try:
            with open(path, "r") as handle:
                command = json.load(handle)
            command_id = str(command.get("id", ""))
            capability = str(command.get("capability", ""))
            if not command_id:
                raise Exception("Missing command id.")
            result = _execute(command)
            _ack(command_id, capability, True, result=result)
        except Exception as error:
            command_id = str(command.get("id", "")) if command else name[:-5]
            capability = str(command.get("capability", "")) if command else ""
            if command_id:
                _ack(command_id, capability, False, error=str(error))
        finally:
            try:
                os.remove(path)
            except Exception:
                pass

def _publish_state(force=False):
    global _last_write
    now = time.time()
    if not force and now - _last_write < WRITE_INTERVAL:
        return
    _last_write = now
    try:
        _atomic_json(STATE, _snapshot())
    except Exception:
        pass

def OnInit():
    _mkdir(COMMANDS)
    _mkdir(ACKS)
    _publish_state(True)

def OnDeInit():
    try:
        if os.path.exists(STATE):
            os.remove(STATE)
    except Exception:
        pass

def OnIdle():
    _process_commands()
    _publish_state(False)

def OnRefresh(flags):
    _publish_state(True)

def OnDirtyMixerTrack(index):
    _publish_state(True)

def OnProjectLoad(status):
    _publish_state(True)
