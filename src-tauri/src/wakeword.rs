use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const STALE_AFTER: Duration = Duration::from_secs(3);
const EVENT_MAX_AGE: Duration = Duration::from_secs(8);
const WAKE_WORD_SCRIPT: &str = include_str!("../../scripts/wakeword/sherpa_wake.py");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WakeWordHeartbeat {
    schema_version: u32,
    engine: String,
    #[serde(default)]
    service_version: Option<String>,
    phrase: String,
    sample_rate: u32,
    #[serde(default)]
    cooldown_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeWordStatus {
    pub available: bool,
    pub stale: bool,
    pub age_ms: Option<u128>,
    pub engine: Option<String>,
    pub service_version: Option<String>,
    pub phrase: Option<String>,
    pub sample_rate: Option<u32>,
    pub cooldown_ms: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeWordEvent {
    pub schema_version: u32,
    pub engine: String,
    #[serde(default)]
    pub event_id: Option<String>,
    pub phrase: String,
    pub detected_at_ms: u64,
}

fn home_dir() -> Result<PathBuf, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .map_err(|_| "Could not determine the current user home directory.".to_string())
}

fn root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".aera").join("wakeword"))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WakeWordInstallResult {
    pub installed: bool,
    pub already_current: bool,
    pub path: String,
    pub instructions: String,
}

pub fn install_companion() -> Result<WakeWordInstallResult, String> {
    let root = root()?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let path = root.join("sherpa_wake.py");

    let already_current = fs::read_to_string(&path)
        .map(|existing| existing == WAKE_WORD_SCRIPT)
        .unwrap_or(false);

    if !already_current {
        fs::write(&path, WAKE_WORD_SCRIPT).map_err(|error| error.to_string())?;
    }

    Ok(WakeWordInstallResult {
        installed: true,
        already_current,
        path: path.to_string_lossy().into_owned(),
        instructions: "Install Python dependencies sounddevice and sherpa-onnx, choose a keyword-spotting model whose license fits your use, then run this local script with its model paths. AERA does not bundle model weights.".into(),
    })
}

fn age(path: &Path) -> Option<Duration> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    SystemTime::now().duration_since(modified).ok()
}

pub fn status() -> WakeWordStatus {
    let path = match root() {
        Ok(root) => root.join("state.json"),
        Err(error) => {
            return WakeWordStatus {
                available: false,
                stale: false,
                age_ms: None,
                engine: None,
                service_version: None,
                phrase: None,
                sample_rate: None,
                cooldown_ms: None,
                error: Some(error),
            }
        }
    };

    if !path.exists() {
        return WakeWordStatus {
            available: false,
            stale: false,
            age_ms: None,
            engine: None,
            service_version: None,
            phrase: None,
            sample_rate: None,
            cooldown_ms: None,
            error: Some("No local wake-word service heartbeat was found.".into()),
        };
    }

    let current_age = age(&path);
    let stale = current_age
        .map(|value| value > STALE_AFTER)
        .unwrap_or(true);

    match fs::read(&path)
        .map_err(|error| error.to_string())
        .and_then(|bytes| {
            serde_json::from_slice::<WakeWordHeartbeat>(&bytes)
                .map_err(|error| error.to_string())
        }) {
        Ok(heartbeat) if heartbeat.schema_version == 1 => WakeWordStatus {
            available: !stale,
            stale,
            age_ms: current_age.map(|value| value.as_millis()),
            engine: Some(heartbeat.engine),
            service_version: heartbeat.service_version,
            phrase: Some(heartbeat.phrase),
            sample_rate: Some(heartbeat.sample_rate),
            cooldown_ms: heartbeat.cooldown_ms,
            error: stale.then(|| "Wake-word service heartbeat is stale.".into()),
        },
        Ok(_) => WakeWordStatus {
            available: false,
            stale,
            age_ms: current_age.map(|value| value.as_millis()),
            engine: None,
            service_version: None,
            phrase: None,
            sample_rate: None,
            cooldown_ms: None,
            error: Some("Wake-word heartbeat uses an unsupported schema.".into()),
        },
        Err(error) => WakeWordStatus {
            available: false,
            stale,
            age_ms: current_age.map(|value| value.as_millis()),
            engine: None,
            service_version: None,
            phrase: None,
            sample_rate: None,
            cooldown_ms: None,
            error: Some(format!("Could not read wake-word heartbeat: {error}")),
        },
    }
}

pub fn consume_event() -> Result<Option<WakeWordEvent>, String> {
    let path = root()?.join("event.json");
    if !path.exists() {
        return Ok(None);
    }

    let current_age = age(&path).unwrap_or(EVENT_MAX_AGE + Duration::from_secs(1));
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(&path);

    if current_age > EVENT_MAX_AGE {
        return Ok(None);
    }

    let event: WakeWordEvent =
        serde_json::from_slice(&bytes).map_err(|error| error.to_string())?;
    if event.schema_version != 1 || event.phrase.trim().is_empty() {
        return Err("Wake-word event failed validation.".into());
    }

    Ok(Some(event))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_schema_is_explicit() {
        let event = WakeWordEvent {
            schema_version: 1,
            engine: "sherpa-onnx".into(),
            event_id: Some("wake-test".into()),
            phrase: "AERA".into(),
            detected_at_ms: 42,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"schemaVersion\":1"));
        assert!(json.contains("\"phrase\":\"AERA\""));
    }
}
