use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

const POSITION_FILE: &str = "orb-position.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
struct OrbPosition {
    x: i32,
    y: i32,
}

fn file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Could not resolve AERA config directory: {error}"))?;
    Ok(directory.join(POSITION_FILE))
}

pub fn save(app: &AppHandle, position: PhysicalPosition<i32>) -> Result<(), String> {
    let path = file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create AERA config directory: {error}"))?;
    }

    let serialized = serde_json::to_vec(&OrbPosition {
        x: position.x,
        y: position.y,
    })
    .map_err(|error| format!("Could not encode AERA position: {error}"))?;

    fs::write(path, serialized)
        .map_err(|error| format!("Could not save AERA position: {error}"))
}

fn saved_position(app: &AppHandle) -> Result<Option<OrbPosition>, String> {
    let path = file_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let bytes = fs::read(path)
        .map_err(|error| format!("Could not read AERA position: {error}"))?;
    let position = serde_json::from_slice::<OrbPosition>(&bytes)
        .map_err(|error| format!("Could not decode AERA position: {error}"))?;
    Ok(Some(position))
}

fn point_on_monitor(position: OrbPosition, monitor: &tauri::Monitor) -> bool {
    let origin = monitor.position();
    let size = monitor.size();

    let right = origin.x.saturating_add(size.width as i32);
    let bottom = origin.y.saturating_add(size.height as i32);

    position.x >= origin.x
        && position.x < right
        && position.y >= origin.y
        && position.y < bottom
}

pub fn restore(window: &WebviewWindow) -> Result<bool, String> {
    let Some(position) = saved_position(window.app_handle())? else {
        return Ok(false);
    };

    let monitors = window
        .available_monitors()
        .map_err(|error| format!("Could not inspect monitors: {error}"))?;

    if !monitors
        .iter()
        .any(|monitor| point_on_monitor(position, monitor))
    {
        return Ok(false);
    }

    window
        .set_position(PhysicalPosition::new(position.x, position.y))
        .map_err(|error| format!("Could not restore AERA position: {error}"))?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn position_serialization_round_trips() {
        let value = OrbPosition { x: -1440, y: 240 };
        let encoded = serde_json::to_vec(&value).unwrap();
        let decoded: OrbPosition = serde_json::from_slice(&encoded).unwrap();
        assert_eq!(decoded.x, -1440);
        assert_eq!(decoded.y, 240);
    }
}
