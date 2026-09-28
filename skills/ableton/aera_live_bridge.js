// AERA Ableton Live companion for a Max for Live device.
// Put this file beside an M4L device containing:
//   [live.thisdevice] -> [js aera_live_bridge.js]
// Launch AERA once first so ~/.aera/bridges/ableton exists.

autowatch = 1;
inlets = 1;
outlets = 1;

var ROOT = "~:/.aera/bridges/ableton/";
var COMMANDS = ROOT + "commands/";
var ACKS = ROOT + "acks/";
var STATE = ROOT + "state.json";
var INTERVAL_MS = 200;
var MAX_DEVICES = 16;
var task = null;
var song = null;
var processed = {};

var CAPABILITIES = [
  "transport.play",
  "transport.stop",
  "transport.record.toggle",
  "track.mute.set",
  "track.solo.set",
  "track.arm.set",
  "track.volume.set",
  "track.pan.set"
];

function scalar(value) {
  if (value instanceof Array) {
    return value.length ? Number(value[value.length - 1]) : 0;
  }
  return Number(value);
}

function asString(value) {
  if (value instanceof Array) return value.join(" ");
  return String(value == null ? "" : value);
}

function writeJson(path, value) {
  var file = new File(path, "write");
  if (!file.isopen) return false;
  file.position = 0;
  file.eof = 0;
  file.writestring(JSON.stringify(value));
  file.close();
  return true;
}

function readJson(path) {
  var file = new File(path, "read");
  if (!file.isopen) return null;
  var text = file.readstring(file.eof);
  file.close();
  return text ? JSON.parse(text) : null;
}

function selectedTrackApi() {
  return new LiveAPI(null, "live_set view selected_track");
}

function selectedPath(api) {
  return String(api.unquotedpath || api.path || "").replace(/"/g, "");
}

function trackIndex(path) {
  var match = /tracks\s+(\d+)/.exec(path);
  return match ? Number(match[1]) : -1;
}

function parameterSnapshot(path) {
  var api = new LiveAPI(null, path);
  if (!api.valid) return null;
  return {
    api: api,
    min: scalar(api.get("min")),
    max: scalar(api.get("max")),
    value: scalar(api.get("value"))
  };
}

function normalizeParameter(parameter) {
  if (!parameter || parameter.max === parameter.min) return 0;
  return (parameter.value - parameter.min) / (parameter.max - parameter.min);
}

function selectedSnapshot() {
  var selected = selectedTrackApi();
  if (!selected.valid) return null;

  var path = selectedPath(selected);
  var index = trackIndex(path);
  var volume = parameterSnapshot(path + " mixer_device volume");
  var pan = parameterSnapshot(path + " mixer_device panning");
  var fx = [];
  var deviceCount = Math.min(selected.getcount("devices"), MAX_DEVICES);

  for (var i = 0; i < deviceCount; i++) {
    var device = new LiveAPI(null, path + " devices " + i);
    if (!device.valid) continue;
    var name = asString(device.getstring("name"));
    if (name) fx.push(name);
  }

  return {
    id: "track:" + index,
    index: index,
    name: asString(selected.getstring("name")),
    muted: scalar(selected.get("mute")) !== 0,
    soloed: scalar(selected.get("solo")) !== 0,
    armed: scalar(selected.get("arm")) !== 0,
    volume: normalizeParameter(volume),
    pan: pan ? normalizeParameter(pan) * 2 - 1 : 0,
    fx: fx
  };
}

function snapshot() {
  song = new LiveAPI(null, "live_set");
  if (!song.valid) throw new Error("Live Set is not available.");

  return {
    schemaVersion: 1,
    dawId: "ableton",
    bridgeVersion: "0.1.0",
    projectName: asString(song.getstring("name")) || null,
    transport: {
      playing: scalar(song.get("is_playing")) !== 0,
      recording: scalar(song.get("record_mode")) !== 0,
      positionSeconds: null,
      positionBeats: scalar(song.get("current_song_time")),
      bpm: scalar(song.get("tempo"))
    },
    selectedTrack: selectedSnapshot(),
    capabilities: CAPABILITIES
  };
}

function setSelectedParameter(kind, normalizedValue) {
  var track = selectedTrackApi();
  if (!track.valid) throw new Error("No selected Ableton track.");
  var path = selectedPath(track);
  var parameter = parameterSnapshot(
    path + " mixer_device " + (kind === "volume" ? "volume" : "panning")
  );
  if (!parameter) throw new Error("Selected track parameter is unavailable.");

  var normalized =
    kind === "volume" ? normalizedValue : (normalizedValue + 1) / 2;
  parameter.api.set(
    "value",
    parameter.min + (parameter.max - parameter.min) * normalized
  );
}

function execute(command) {
  if (command.schemaVersion !== 1) {
    throw new Error("Unsupported AERA bridge schema.");
  }

  var input = command.input || {};
  if (input.appId !== "ableton") {
    throw new Error("Command target is not Ableton.");
  }

  song = new LiveAPI(null, "live_set");
  var selected = selectedTrackApi();
  var capability = String(command.capability || "");

  if (capability === "transport.play") {
    song.call("start_playing");
  } else if (capability === "transport.stop") {
    song.call("stop_playing");
  } else if (capability === "transport.record.toggle") {
    song.set("record_mode", scalar(song.get("record_mode")) ? 0 : 1);
  } else if (
    capability === "track.mute.set" ||
    capability === "track.solo.set" ||
    capability === "track.arm.set"
  ) {
    if (!selected.valid || input.target !== "selected" || typeof input.value !== "boolean") {
      throw new Error("Selected-track boolean command is invalid.");
    }
    var property =
      capability === "track.mute.set"
        ? "mute"
        : capability === "track.solo.set"
          ? "solo"
          : "arm";
    selected.set(property, input.value ? 1 : 0);
  } else if (capability === "track.volume.set") {
    var volume = Number(input.value);
    if (input.target !== "selected" || volume < 0 || volume > 1) {
      throw new Error("Volume command must target selected with a 0..1 value.");
    }
    setSelectedParameter("volume", volume);
  } else if (capability === "track.pan.set") {
    var pan = Number(input.value);
    if (input.target !== "selected" || pan < -1 || pan > 1) {
      throw new Error("Pan command must target selected with a -1..1 value.");
    }
    setSelectedParameter("pan", pan);
  } else {
    throw new Error("Unsupported AERA Ableton capability.");
  }

  return snapshot();
}

function acknowledge(id, capability, ok, result, error) {
  writeJson(ACKS + id + ".json", {
    id: id,
    ok: !!ok,
    capability: capability,
    result: result || null,
    error: error ? String(error) : null
  });
}

function processCommands() {
  var folder = new Folder(COMMANDS);
  if (folder.end) {
    folder.close();
    return;
  }

  var count = 0;
  while (!folder.end && count < 8) {
    var name = folder.filename;
    folder.next();

    if (!name || name.slice(-5) !== ".json") continue;
    var idFromName = name.slice(0, -5);
    if (processed[idFromName]) continue;

    processed[idFromName] = true;
    count += 1;
    var command = null;

    try {
      command = readJson(COMMANDS + name);
      if (!command || !command.id) throw new Error("Invalid command envelope.");
      acknowledge(
        String(command.id),
        String(command.capability || ""),
        true,
        execute(command),
        null
      );
    } catch (error) {
      acknowledge(
        command && command.id ? String(command.id) : idFromName,
        command && command.capability ? String(command.capability) : "",
        false,
        null,
        error
      );
    }
  }
  folder.close();

  if (Object.keys(processed).length > 256) processed = {};
}

function tick() {
  try {
    processCommands();
    writeJson(STATE, snapshot());
  } catch (error) {
    post("AERA Ableton bridge: " + error + "\n");
  }
}

function bang() {
  if (task && task.running) return;
  song = new LiveAPI(null, "live_set");
  task = new Task(tick, this);
  task.interval = INTERVAL_MS;
  task.repeat();
  tick();
  post("AERA Ableton bridge active\n");
}

function notifydeleted() {
  if (task) {
    task.cancel();
    task.freepeer();
    task = null;
  }
}
