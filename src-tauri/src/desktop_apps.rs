use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownAppStatus {
    pub id: String,
    pub name: String,
    pub installed: bool,
    pub path: Option<String>,
}

fn reaper_candidates() -> Vec<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let mut paths = vec![
            PathBuf::from("/Applications/REAPER.app"),
            PathBuf::from("/Applications/REAPER64.app"),
        ];

        if let Ok(home) = std::env::var("HOME") {
            paths.push(PathBuf::from(&home).join("Applications/REAPER.app"));
            paths.push(PathBuf::from(home).join("Applications/REAPER64.app"));
        }

        paths
    }

    #[cfg(target_os = "windows")]
    {
        let mut paths = Vec::new();

        if let Ok(program_files) = std::env::var("ProgramFiles") {
            paths.push(PathBuf::from(&program_files).join("REAPER (x64)/reaper.exe"));
            paths.push(PathBuf::from(program_files).join("REAPER/reaper.exe"));
        }

        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            paths.push(PathBuf::from(program_files_x86).join("REAPER/reaper.exe"));
        }

        paths
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Vec::new()
    }
}

fn find_existing(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|path| path.exists())
}

fn reaper_status() -> KnownAppStatus {
    let path = find_existing(reaper_candidates());
    KnownAppStatus {
        id: "reaper".into(),
        name: "REAPER".into(),
        installed: path.is_some(),
        path: path.map(|path| path.to_string_lossy().into_owned()),
    }
}

pub fn status(app_id: &str) -> Result<KnownAppStatus, String> {
    match app_id {
        "reaper" => Ok(reaper_status()),
        _ => Err("Unknown application id. AERA only opens explicitly whitelisted applications.".into()),
    }
}

#[cfg(target_os = "macos")]
fn launch_reaper(path: &Path) -> Result<(), String> {
    let status = Command::new("/usr/bin/open")
        .arg(path)
        .status()
        .map_err(|error| format!("Could not launch REAPER: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("macOS returned exit status {status} while launching REAPER."))
    }
}

#[cfg(target_os = "windows")]
fn launch_reaper(path: &Path) -> Result<(), String> {
    Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not launch REAPER: {error}"))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn launch_reaper(_path: &Path) -> Result<(), String> {
    Err("REAPER launch is currently supported on macOS and Windows.".into())
}

pub fn open(app_id: &str) -> Result<(), String> {
    match app_id {
        "reaper" => {
            let path = find_existing(reaper_candidates())
                .ok_or_else(|| "REAPER was not found in a supported install location.".to_string())?;
            launch_reaper(&path)
        }
        _ => Err("Unknown application id. Arbitrary process execution is not allowed.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_apps_are_rejected() {
        assert!(status("terminal").is_err());
        assert!(open("terminal").is_err());
    }

    #[test]
    fn reaper_status_uses_stable_identity() {
        let status = reaper_status();
        assert_eq!(status.id, "reaper");
        assert_eq!(status.name, "REAPER");
    }
}
