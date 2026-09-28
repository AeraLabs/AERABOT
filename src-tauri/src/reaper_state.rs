use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const STATE_FILE: &str = "aera-state.json";
const STALE_AFTER: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaperTrackState {
    pub index: u32,
    pub guid: String,
    pub name: String,
    pub selected: bool,
    pub muted: bool,
    pub soloed: bool,
    pub armed: bool,
    pub monitoring: bool,
    pub volume: f64,
    pub pan: f64,
    pub item_count: u32,
    pub fx_count: u32,
    pub folder_depth: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectedTrackSummary {
    pub index: u32,
    pub guid: String,
    pub name: String,
    pub muted: bool,
    pub soloed: bool,
    pub armed: bool,
    pub monitoring: bool,
    pub volume: f64,
    pub pan: f64,
    pub fx: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaperProjectState {
    pub schema_version: u32,
    pub reaper_version: String,
    pub bridge_time: f64,
    pub project_name: String,
    pub project_file: String,
    pub state_change_count: i64,
    pub play_state: i32,
    pub playing: bool,
    pub paused: bool,
    pub recording: bool,
    pub play_position: f64,
    pub cursor_position: f64,
    pub project_length: f64,
    pub bpm: f64,
    pub track_count: u32,
    pub tracks_truncated: bool,
    pub selected_track: Option<SelectedTrackSummary>,
    pub tracks: Vec<ReaperTrackState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaperBridgeStatus {
    pub available: bool,
    pub stale: bool,
    pub age_ms: Option<u128>,
    pub path: Option<String>,
    pub state: Option<ReaperProjectState>,
    pub error: Option<String>,
}

fn state_path_candidates() -> Vec<PathBuf> {
    if let Ok(explicit) = std::env::var("AERA_REAPER_STATE_PATH") {
        if !explicit.trim().is_empty() {
            return vec![PathBuf::from(explicit)];
        }
    }

    let mut paths = Vec::new();

    if let Ok(resource) = std::env::var("AERA_REAPER_RESOURCE_PATH") {
        if !resource.trim().is_empty() {
            paths.push(
                PathBuf::from(resource)
                    .join("Scripts")
                    .join("AERA")
                    .join(STATE_FILE),
            );
        }
    }

    #[cfg(target_os = "macos")]
    if let Ok(home) = std::env::var("HOME") {
        paths.push(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("REAPER")
                .join("Scripts")
                .join("AERA")
                .join(STATE_FILE),
        );
    }

    #[cfg(target_os = "windows")]
    if let Ok(app_data) = std::env::var("APPDATA") {
        paths.push(
            PathBuf::from(app_data)
                .join("REAPER")
                .join("Scripts")
                .join("AERA")
                .join(STATE_FILE),
        );
    }

    paths
}

fn newest_existing(paths: &[PathBuf]) -> Option<PathBuf> {
    paths
        .iter()
        .filter(|path| path.exists())
        .max_by_key(|path| {
            fs::metadata(path)
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH)
        })
        .cloned()
}

fn age(path: &Path) -> Option<Duration> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    SystemTime::now().duration_since(modified).ok()
}

pub fn read_status() -> ReaperBridgeStatus {
    let candidates = state_path_candidates();
    let Some(path) = newest_existing(&candidates) else {
        return ReaperBridgeStatus {
            available: false,
            stale: false,
            age_ms: None,
            path: candidates
                .first()
                .map(|path| path.to_string_lossy().into_owned()),
            state: None,
            error: Some(
                "AERA REAPER ReaScript state was not found. Load and run skills/reaper/reascript/aera_bridge.lua in REAPER."
                    .into(),
            ),
        };
    };

    let age = age(&path);
    let age_ms = age.map(|value| value.as_millis());
    let stale = age.map(|value| value > STALE_AFTER).unwrap_or(true);

    let bytes = match fs::read(&path) {
        Ok(bytes) => bytes,
        Err(error) => {
            return ReaperBridgeStatus {
                available: false,
                stale,
                age_ms,
                path: Some(path.to_string_lossy().into_owned()),
                state: None,
                error: Some(format!("Could not read REAPER bridge state: {error}")),
            };
        }
    };

    match serde_json::from_slice::<ReaperProjectState>(&bytes) {
        Ok(state) => ReaperBridgeStatus {
            available: true,
            stale,
            age_ms,
            path: Some(path.to_string_lossy().into_owned()),
            state: Some(state),
            error: if stale {
                Some("REAPER bridge state is stale; the ReaScript may not be running.".into())
            } else {
                None
            },
        },
        Err(error) => ReaperBridgeStatus {
            available: false,
            stale,
            age_ms,
            path: Some(path.to_string_lossy().into_owned()),
            state: None,
            error: Some(format!(
                "REAPER bridge state is incomplete or invalid: {error}"
            )),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_valid_bridge_snapshot() {
        let json = r#"{
          "schemaVersion":1,
          "reaperVersion":"7.80/x64",
          "bridgeTime":1.0,
          "projectName":"Song.rpp",
          "projectFile":"",
          "stateChangeCount":2,
          "playState":1,
          "playing":true,
          "paused":false,
          "recording":false,
          "playPosition":12.5,
          "cursorPosition":4.0,
          "projectLength":180.0,
          "bpm":120.0,
          "trackCount":0,
          "tracksTruncated":false,
          "selectedTrack":null,
          "tracks":[]
        }"#;

        let state: ReaperProjectState = serde_json::from_str(json).unwrap();
        assert_eq!(state.project_name, "Song.rpp");
        assert!(state.playing);
    }
}
