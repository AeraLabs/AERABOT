use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

const SCHEMA_VERSION: u32 = 1;
const STALE_AFTER: Duration = Duration::from_secs(3);
const ACK_TIMEOUT: Duration = Duration::from_millis(1800);
const FL_STUDIO_SCRIPT: &str = include_str!("../../skills/flstudio/device_AERA.py");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DawTrackState {
    pub id: String,
    pub index: i32,
    pub name: String,
    pub muted: bool,
    pub soloed: bool,
    pub armed: bool,
    pub volume: f64,
    pub pan: f64,
    #[serde(default)]
    pub fx: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DawTransportState {
    pub playing: bool,
    pub recording: bool,
    pub position_seconds: Option<f64>,
    pub bpm: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DawState {
    pub schema_version: u32,
    pub daw_id: String,
    pub bridge_version: String,
    pub project_name: Option<String>,
    pub transport: DawTransportState,
    pub selected_track: Option<DawTrackState>,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DawBridgeStatus {
    pub available: bool,
    pub stale: bool,
    pub age_ms: Option<u128>,
    pub path: Option<String>,
    pub state: Option<DawState>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DawCommandAck {
    pub id: String,
    pub ok: bool,
    pub capability: String,
    pub result: Option<Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DawBridgeInstallResult {
    pub installed: bool,
    pub already_current: bool,
    pub path: String,
    pub instructions: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DawCommandEnvelope {
    schema_version: u32,
    id: String,
    capability: String,
    input: Value,
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Could not determine the current user home directory.".to_string())
}

fn bridge_root(daw_id: &str) -> Result<PathBuf, String> {
    Ok(home_dir()?
        .join(".aera")
        .join("bridges")
        .join(daw_id))
}

fn state_path(daw_id: &str) -> Result<PathBuf, String> {
    Ok(bridge_root(daw_id)?.join("state.json"))
}

fn age(path: &Path) -> Option<Duration> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    SystemTime::now().duration_since(modified).ok()
}

pub fn read_status(daw_id: &str) -> DawBridgeStatus {
    let path = match state_path(daw_id) {
        Ok(path) => path,
        Err(error) => {
            return DawBridgeStatus {
                available: false,
                stale: false,
                age_ms: None,
                path: None,
                state: None,
                error: Some(error),
            }
        }
    };

    if !path.exists() {
        return DawBridgeStatus {
            available: false,
            stale: false,
            age_ms: None,
            path: Some(path.to_string_lossy().into_owned()),
            state: None,
            error: Some(format!(
                "The {daw_id} AERA companion bridge is not publishing state yet."
            )),
        };
    }

    let age = age(&path);
    let stale = age.map(|value| value > STALE_AFTER).unwrap_or(true);
    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) => {
            return DawBridgeStatus {
                available: false,
                stale,
                age_ms: age.map(|value| value.as_millis()),
                path: Some(path.to_string_lossy().into_owned()),
                state: None,
                error: Some(format!("Could not read DAW bridge state: {error}")),
            }
        }
    };

    match serde_json::from_slice::<DawState>(&bytes) {
        Ok(state) if state.schema_version == SCHEMA_VERSION && state.daw_id == daw_id => {
            DawBridgeStatus {
                available: true,
                stale,
                age_ms: age.map(|value| value.as_millis()),
                path: Some(path.to_string_lossy().into_owned()),
                state: Some(state),
                error: stale
                    .then(|| "The DAW bridge state is stale; its companion may not be active.".into()),
            }
        }
        Ok(_) => DawBridgeStatus {
            available: false,
            stale,
            age_ms: age.map(|value| value.as_millis()),
            path: Some(path.to_string_lossy().into_owned()),
            state: None,
            error: Some("DAW bridge identity/schema mismatch.".into()),
        },
        Err(error) => DawBridgeStatus {
            available: false,
            stale,
            age_ms: age.map(|value| value.as_millis()),
            path: Some(path.to_string_lossy().into_owned()),
            state: None,
            error: Some(format!("DAW bridge state is invalid: {error}")),
        },
    }
}

fn allowed_capability(capability: &str, input: &Value) -> bool {
    let app_id = input.get("appId").and_then(Value::as_str);
    let target = input.get("target").and_then(Value::as_str);
    let boolean_value = input.get("value").and_then(Value::as_bool);
    let number_value = input.get("value").and_then(Value::as_f64);

    match capability {
        "transport.play" | "transport.stop" | "transport.record.toggle" => {
            app_id == Some("flstudio")
        }
        "track.mute.set" | "track.solo.set" | "track.arm.set" => {
            app_id == Some("flstudio")
                && target == Some("selected")
                && boolean_value.is_some()
        }
        "track.volume.set" => {
            app_id == Some("flstudio")
                && target == Some("selected")
                && number_value.map(|value| (0.0..=1.0).contains(&value)) == Some(true)
        }
        "track.pan.set" => {
            app_id == Some("flstudio")
                && target == Some("selected")
                && number_value.map(|value| (-1.0..=1.0).contains(&value)) == Some(true)
        }
        _ => false,
    }
}

fn atomic_write_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Bridge path has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("tmp");
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    fs::write(&temporary, bytes).map_err(|error| error.to_string())?;
    if path.exists() {
        let _ = fs::remove_file(path);
    }
    fs::rename(&temporary, path).map_err(|error| error.to_string())
}

pub fn send_command(
    daw_id: &str,
    id: String,
    capability: String,
    input: Value,
) -> Result<DawCommandAck, String> {
    if daw_id != "flstudio" {
        return Err("This DAW bridge command path is not enabled yet.".into());
    }

    if id.len() < 3 || id.len() > 160 || !id.chars().all(|c| c.is_ascii_alphanumeric() || "-_".contains(c)) {
        return Err("Invalid DAW command id.".into());
    }

    if !allowed_capability(&capability, &input) {
        return Err("AERA rejected an unsupported or invalid FL Studio command.".into());
    }

    let status = read_status(daw_id);
    let state = status
        .state
        .ok_or_else(|| status.error.unwrap_or_else(|| "FL Studio bridge is unavailable.".into()))?;
    if status.stale {
        return Err("FL Studio bridge state is stale; command not sent.".into());
    }
    if !state.capabilities.iter().any(|candidate| candidate == &capability) {
        return Err("The connected FL Studio bridge does not advertise this capability.".into());
    }

    let root = bridge_root(daw_id)?;
    let command_path = root.join("commands").join(format!("{id}.json"));
    let ack_path = root.join("acks").join(format!("{id}.json"));
    let _ = fs::remove_file(&ack_path);

    let envelope = DawCommandEnvelope {
        schema_version: SCHEMA_VERSION,
        id: id.clone(),
        capability: capability.clone(),
        input,
    };
    atomic_write_json(&command_path, &envelope)?;

    let started = Instant::now();
    while started.elapsed() < ACK_TIMEOUT {
        if ack_path.exists() {
            let bytes = fs::read(&ack_path).map_err(|error| error.to_string())?;
            let ack: DawCommandAck =
                serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
            let _ = fs::remove_file(&ack_path);
            if ack.id != id || ack.capability != capability {
                return Err("FL Studio returned a mismatched command acknowledgement.".into());
            }
            if ack.ok {
                return Ok(ack);
            }
            return Err(ack
                .error
                .unwrap_or_else(|| "FL Studio rejected the requested command.".into()));
        }
        thread::sleep(Duration::from_millis(30));
    }

    let _ = fs::remove_file(&command_path);
    Err("FL Studio did not acknowledge the command in time.".into())
}

fn fl_studio_script_path() -> Result<PathBuf, String> {
    Ok(home_dir()?
        .join("Documents")
        .join("Image-Line")
        .join("FL Studio")
        .join("Settings")
        .join("Hardware")
        .join("AERA")
        .join("device_AERA.py"))
}

pub fn install_fl_studio_bridge() -> Result<DawBridgeInstallResult, String> {
    let path = fl_studio_script_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "FL Studio script path is invalid.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let already_current = fs::read_to_string(&path)
        .map(|existing| existing == FL_STUDIO_SCRIPT)
        .unwrap_or(false);

    if !already_current {
        fs::write(&path, FL_STUDIO_SCRIPT).map_err(|error| error.to_string())?;
    }

    Ok(DawBridgeInstallResult {
        installed: true,
        already_current,
        path: path.to_string_lossy().into_owned(),
        instructions: "In FL Studio open MIDI Settings and choose “AERA Local Bridge (user)” as the Controller type for any enabled input port. The script itself performs all control through FL Studio's MIDI Scripting API.".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_arbitrary_capabilities() {
        assert!(!allowed_capability(
            "shell.execute",
            &serde_json::json!({"appId":"flstudio"})
        ));
    }

    #[test]
    fn validates_selected_track_values() {
        assert!(allowed_capability(
            "track.mute.set",
            &serde_json::json!({"appId":"flstudio","target":"selected","value":true})
        ));
        assert!(!allowed_capability(
            "track.volume.set",
            &serde_json::json!({"appId":"flstudio","target":"selected","value":1.5})
        ));
        assert!(allowed_capability(
            "track.pan.set",
            &serde_json::json!({"appId":"flstudio","target":"selected","value":-0.75})
        ));
    }
}
