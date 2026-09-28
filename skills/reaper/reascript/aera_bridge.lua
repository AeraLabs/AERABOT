-- AERA REAPER Bridge
-- Read-only project/track telemetry for the local AERA desktop runtime.
-- This script never sends audio, changes the project, or connects to a network.
-- Run it as a deferred ReaScript inside REAPER.

local SCHEMA_VERSION = 1
local WRITE_INTERVAL = 0.15
local MAX_TRACKS = 256
local MAX_SELECTED_FX = 32

local resource_path = reaper.GetResourcePath()
local separator = package.config:sub(1, 1)
local bridge_dir = resource_path .. separator .. "Scripts" .. separator .. "AERA"
local state_path = bridge_dir .. separator .. "aera-state.json"
local temp_path = bridge_dir .. separator .. "aera-state.tmp"
local command_path = bridge_dir .. separator .. "aera-command.tsv"
local result_path = bridge_dir .. separator .. "aera-result.tsv"
local result_temp_path = bridge_dir .. separator .. "aera-result.tmp"

reaper.RecursiveCreateDirectory(bridge_dir, 0)

local last_write = 0.0
local last_change_count = -1
local last_selected_guid = ""
local cached_tracks_json = "[]"
local cached_track_count = 0
local cached_tracks_truncated = false
local cached_selected_json = "null"

local function json_escape(value)
  value = tostring(value or "")
  return '"' .. value:gsub('[%z\1-\31\\"]', function(char)
    if char == '"' then return '\\"' end
    if char == '\\' then return '\\\\' end
    if char == '\b' then return '\\b' end
    if char == '\f' then return '\\f' end
    if char == '\n' then return '\\n' end
    if char == '\r' then return '\\r' end
    if char == '\t' then return '\\t' end
    return string.format("\\u%04x", string.byte(char))
  end) .. '"'
end

local function json_number(value)
  if type(value) ~= "number" or value ~= value or value == math.huge or value == -math.huge then
    return "0"
  end
  return string.format("%.10g", value)
end

local function json_bool(value)
  return value and "true" or "false"
end

local function clean_result_text(value)
  return tostring(value or ""):gsub("[\t\r\n]", " ")
end

local function write_command_result(id, ok, before, after, message)
  local file = io.open(result_temp_path, "wb")
  if not file then return end
  file:write(table.concat({
    clean_result_text(id),
    ok and "1" or "0",
    before and "1" or "0",
    after and "1" or "0",
    clean_result_text(message)
  }, "\t") .. "\n")
  file:flush()
  file:close()
  os.remove(result_path)
  os.rename(result_temp_path, result_path)
end

local function find_track_by_guid(project, guid)
  local track_count = reaper.CountTracks(project)
  for index = 0, track_count - 1 do
    local track = reaper.GetTrack(project, index)
    if track and (reaper.GetTrackGUID(track) or "") == guid then
      return track
    end
  end
  return nil
end

local function track_bool_value(track, operation)
  if operation == "mute" then
    return reaper.GetMediaTrackInfo_Value(track, "B_MUTE") > 0.5
  elseif operation == "solo" then
    return reaper.GetMediaTrackInfo_Value(track, "I_SOLO") > 0
  elseif operation == "arm" then
    return reaper.GetMediaTrackInfo_Value(track, "I_RECARM") > 0.5
  end
  return false
end

local function apply_track_operation(track, operation, value)
  local numeric = value and 1 or 0
  if operation == "mute" then
    return reaper.SetTrackUIMute(track, numeric, 3) >= 0
  elseif operation == "solo" then
    return reaper.SetTrackUISolo(track, numeric, 3) >= 0
  elseif operation == "arm" then
    return reaper.SetTrackUIRecArm(track, numeric, 3) >= 0
  end
  return false
end

local function process_command(project)
  local file = io.open(command_path, "rb")
  if not file then return end
  local payload = file:read("*a") or ""
  file:close()
  os.remove(command_path)

  local id, operation, guid, raw_value =
    payload:match("^([^\t\r\n]+)\t([^\t\r\n]+)\t([^\t\r\n]+)\t([01])")

  if not id then
    return
  end

  if operation ~= "mute" and operation ~= "solo" and operation ~= "arm" then
    write_command_result(id, false, false, false, "Unsupported REAPER track operation.")
    return
  end

  local track = find_track_by_guid(project, guid)
  if not track then
    write_command_result(id, false, false, false, "The target REAPER track no longer exists.")
    return
  end

  local before = track_bool_value(track, operation)
  local requested = raw_value == "1"
  local ok = apply_track_operation(track, operation, requested)
  local after = track_bool_value(track, operation)

  if ok and after == requested then
    last_change_count = -1
    reaper.UpdateArrange()
    write_command_result(id, true, before, after, "")
  else
    write_command_result(
      id,
      false,
      before,
      after,
      "REAPER did not apply the requested track state."
    )
  end
end


local function bit_set(flags, bit)
  return (flags & bit) ~= 0
end

local function track_snapshot(track, index)
  local name, flags = reaper.GetTrackState(track)
  local guid = reaper.GetTrackGUID(track) or ""
  local volume = reaper.GetMediaTrackInfo_Value(track, "D_VOL")
  local pan = reaper.GetMediaTrackInfo_Value(track, "D_PAN")
  local folder_depth = reaper.GetMediaTrackInfo_Value(track, "I_FOLDERDEPTH")
  local item_count = reaper.CountTrackMediaItems(track)
  local fx_count = reaper.TrackFX_GetCount(track)

  return table.concat({
    "{",
    '"index":', tostring(index + 1), ",",
    '"guid":', json_escape(guid), ",",
    '"name":', json_escape(name), ",",
    '"selected":', json_bool(bit_set(flags, 2)), ",",
    '"muted":', json_bool(bit_set(flags, 8)), ",",
    '"soloed":', json_bool(bit_set(flags, 16)), ",",
    '"armed":', json_bool(bit_set(flags, 64)), ",",
    '"monitoring":', json_bool(bit_set(flags, 128) or bit_set(flags, 256)), ",",
    '"volume":', json_number(volume), ",",
    '"pan":', json_number(pan), ",",
    '"itemCount":', tostring(item_count), ",",
    '"fxCount":', tostring(fx_count), ",",
    '"folderDepth":', tostring(math.floor(folder_depth)),
    "}"
  })
end

local function selected_track_snapshot(track, index)
  if not track then return "null" end

  local name, flags = reaper.GetTrackState(track)
  local fx = {}
  local fx_count = math.min(reaper.TrackFX_GetCount(track), MAX_SELECTED_FX)
  for fx_index = 0, fx_count - 1 do
    local ok, fx_name = reaper.TrackFX_GetFXName(track, fx_index, "")
    if ok then
      fx[#fx + 1] = json_escape(fx_name)
    end
  end

  return table.concat({
    "{",
    '"index":', tostring(index + 1), ",",
    '"guid":', json_escape(reaper.GetTrackGUID(track) or ""), ",",
    '"name":', json_escape(name), ",",
    '"muted":', json_bool(bit_set(flags, 8)), ",",
    '"soloed":', json_bool(bit_set(flags, 16)), ",",
    '"armed":', json_bool(bit_set(flags, 64)), ",",
    '"monitoring":', json_bool(bit_set(flags, 128) or bit_set(flags, 256)), ",",
    '"volume":', json_number(reaper.GetMediaTrackInfo_Value(track, "D_VOL")), ",",
    '"pan":', json_number(reaper.GetMediaTrackInfo_Value(track, "D_PAN")), ",",
    '"fx":[', table.concat(fx, ","), "]",
    "}"
  })
end

local function selected_guid(project)
  local selected = reaper.GetSelectedTrack(project, 0)
  if not selected then return "" end
  return reaper.GetTrackGUID(selected) or ""
end

local function rebuild_track_cache(project)
  local track_count = reaper.CountTracks(project)
  local emit_count = math.min(track_count, MAX_TRACKS)
  local tracks = {}
  local selected_track = nil
  local selected_index = -1

  for index = 0, emit_count - 1 do
    local track = reaper.GetTrack(project, index)
    if track then
      tracks[#tracks + 1] = track_snapshot(track, index)
      local _, flags = reaper.GetTrackState(track)
      if not selected_track and bit_set(flags, 2) then
        selected_track = track
        selected_index = index
      end
    end
  end

  -- Selected track may live after the telemetry cap.
  if not selected_track then
    local selected = reaper.GetSelectedTrack(project, 0)
    if selected then
      selected_track = selected
      selected_index = math.floor(reaper.GetMediaTrackInfo_Value(selected, "IP_TRACKNUMBER")) - 1
    end
  end

  cached_tracks_json = "[" .. table.concat(tracks, ",") .. "]"
  cached_track_count = track_count
  cached_tracks_truncated = track_count > emit_count
  cached_selected_json = selected_track_snapshot(selected_track, selected_index)
  last_selected_guid = selected_track and (reaper.GetTrackGUID(selected_track) or "") or ""
end

local function write_snapshot()
  local project, project_file = reaper.EnumProjects(-1, "")
  if not project then return end

  local change_count = reaper.GetProjectStateChangeCount(project)
  local current_selected_guid = selected_guid(project)
  if change_count ~= last_change_count or current_selected_guid ~= last_selected_guid then
    rebuild_track_cache(project)
    last_change_count = change_count
  end

  local play_state = reaper.GetPlayStateEx(project)
  local play_position = reaper.GetPlayPositionEx(project)
  local cursor_position = reaper.GetCursorPositionEx(project)
  local project_length = reaper.GetProjectLength(project)
  local project_name = reaper.GetProjectName(project)
  local bpm = reaper.TimeMap2_GetDividedBpmAtTime(project, play_position)

  local json = table.concat({
    "{",
    '"schemaVersion":', tostring(SCHEMA_VERSION), ",",
    '"reaperVersion":', json_escape(reaper.GetAppVersion()), ",",
    '"bridgeTime":', json_number(reaper.time_precise()), ",",
    '"projectName":', json_escape(project_name), ",",
    '"projectFile":', json_escape(project_file or ""), ",",
    '"stateChangeCount":', tostring(change_count), ",",
    '"playState":', tostring(play_state), ",",
    '"playing":', json_bool(bit_set(play_state, 1)), ",",
    '"paused":', json_bool(bit_set(play_state, 2)), ",",
    '"recording":', json_bool(bit_set(play_state, 4)), ",",
    '"playPosition":', json_number(play_position), ",",
    '"cursorPosition":', json_number(cursor_position), ",",
    '"projectLength":', json_number(project_length), ",",
    '"bpm":', json_number(bpm), ",",
    '"trackCount":', tostring(cached_track_count), ",",
    '"tracksTruncated":', json_bool(cached_tracks_truncated), ",",
    '"selectedTrack":', cached_selected_json, ",",
    '"tracks":', cached_tracks_json,
    "}"
  })

  local file = io.open(temp_path, "wb")
  if not file then return end
  file:write(json)
  file:flush()
  file:close()

  os.remove(state_path)
  os.rename(temp_path, state_path)
end

local function loop()
  local project = select(1, reaper.EnumProjects(-1, ""))
  if project then
    process_command(project)
  end

  local now = reaper.time_precise()
  if now - last_write >= WRITE_INTERVAL then
    write_snapshot()
    last_write = now
  end
  reaper.defer(loop)
end

local function cleanup()
  os.remove(temp_path)
  os.remove(command_path)
  os.remove(result_temp_path)
end

reaper.atexit(cleanup)
rebuild_track_cache(select(1, reaper.EnumProjects(-1, "")))
write_snapshot()
reaper.defer(loop)
