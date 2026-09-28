use serde::Serialize;
use std::fs;
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

#[derive(Clone, Copy)]
struct AppSpec {
    id: &'static str,
    name: &'static str,
}

const REAPER: AppSpec = AppSpec { id: "reaper", name: "REAPER" };
const FL_STUDIO: AppSpec = AppSpec { id: "flstudio", name: "FL Studio" };
const PRO_TOOLS: AppSpec = AppSpec { id: "protools", name: "Pro Tools" };
const LOGIC: AppSpec = AppSpec { id: "logic", name: "Logic Pro" };
const ABLETON: AppSpec = AppSpec { id: "ableton", name: "Ableton Live" };

fn spec(app_id: &str) -> Option<AppSpec> {
    match app_id {
        "reaper" => Some(REAPER),
        "flstudio" => Some(FL_STUDIO),
        "protools" => Some(PRO_TOOLS),
        "logic" => Some(LOGIC),
        "ableton" => Some(ABLETON),
        _ => None,
    }
}

fn find_existing(candidates: Vec<PathBuf>) -> Option<PathBuf> {
    candidates.into_iter().find(|path| path.exists())
}

fn push_prefix_matches(
    output: &mut Vec<PathBuf>,
    directory: &Path,
    prefix: &str,
    suffix: &str,
) {
    let Ok(entries) = fs::read_dir(directory) else {
        return;
    };

    let mut matches: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with(prefix) && name.ends_with(suffix))
                .unwrap_or(false)
        })
        .collect();

    matches.sort();
    matches.reverse();
    output.extend(matches);
}

#[cfg(target_os = "macos")]
fn candidates(app: AppSpec) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let mut roots = vec![PathBuf::from("/Applications")];
    if let Ok(home) = std::env::var("HOME") {
        roots.push(PathBuf::from(home).join("Applications"));
    }

    match app.id {
        "reaper" => {
            for root in &roots {
                paths.push(root.join("REAPER.app"));
                paths.push(root.join("REAPER64.app"));
            }
        }
        "flstudio" => {
            for root in &roots {
                paths.push(root.join("FL Studio.app"));
                push_prefix_matches(&mut paths, root, "FL Studio", ".app");
            }
        }
        "protools" => {
            for root in &roots {
                paths.push(root.join("Pro Tools.app"));
            }
        }
        "logic" => {
            for root in &roots {
                paths.push(root.join("Logic Pro.app"));
                paths.push(root.join("Logic Pro X.app"));
            }
        }
        "ableton" => {
            for root in &roots {
                push_prefix_matches(&mut paths, root, "Ableton Live", ".app");
            }
        }
        _ => {}
    }

    paths
}

#[cfg(target_os = "windows")]
fn candidates(app: AppSpec) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let program_files = std::env::var("ProgramFiles").ok().map(PathBuf::from);
    let program_files_x86 = std::env::var("ProgramFiles(x86)").ok().map(PathBuf::from);
    let program_data = std::env::var("ProgramData").ok().map(PathBuf::from);

    match app.id {
        "reaper" => {
            if let Some(root) = &program_files {
                paths.push(root.join("REAPER (x64)").join("reaper.exe"));
                paths.push(root.join("REAPER").join("reaper.exe"));
            }
            if let Some(root) = &program_files_x86 {
                paths.push(root.join("REAPER").join("reaper.exe"));
            }
        }
        "flstudio" => {
            if let Some(root) = &program_files {
                let image_line = root.join("Image-Line");
                if let Ok(entries) = fs::read_dir(&image_line) {
                    let mut versions: Vec<PathBuf> = entries
                        .flatten()
                        .map(|entry| entry.path())
                        .filter(|path| {
                            path.file_name()
                                .and_then(|name| name.to_str())
                                .map(|name| name.starts_with("FL Studio"))
                                .unwrap_or(false)
                        })
                        .collect();
                    versions.sort();
                    versions.reverse();
                    for version in versions {
                        paths.push(version.join("FL64.exe"));
                        paths.push(version.join("FL.exe"));
                    }
                }
            }
        }
        "protools" => {
            if let Some(root) = &program_files {
                paths.push(root.join("Avid").join("Pro Tools").join("ProTools.exe"));
            }
        }
        "logic" => {
            // Logic Pro is macOS-only.
        }
        "ableton" => {
            for root in [program_data.as_ref(), program_files.as_ref()].into_iter().flatten() {
                let ableton_root = root.join("Ableton");
                if let Ok(entries) = fs::read_dir(&ableton_root) {
                    let mut versions: Vec<PathBuf> = entries
                        .flatten()
                        .map(|entry| entry.path())
                        .filter(|path| {
                            path.file_name()
                                .and_then(|name| name.to_str())
                                .map(|name| name.starts_with("Live "))
                                .unwrap_or(false)
                        })
                        .collect();
                    versions.sort();
                    versions.reverse();

                    for version in versions {
                        let Some(folder_name) = version.file_name().and_then(|name| name.to_str()) else {
                            continue;
                        };
                        paths.push(
                            version
                                .join("Program")
                                .join(format!("Ableton {folder_name}.exe")),
                        );
                    }
                }
            }
        }
        _ => {}
    }

    paths
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn candidates(_app: AppSpec) -> Vec<PathBuf> {
    Vec::new()
}

fn app_status(app: AppSpec) -> KnownAppStatus {
    let path = find_existing(candidates(app));
    KnownAppStatus {
        id: app.id.into(),
        name: app.name.into(),
        installed: path.is_some(),
        path: path.map(|path| path.to_string_lossy().into_owned()),
    }
}

pub fn status(app_id: &str) -> Result<KnownAppStatus, String> {
    let app = spec(app_id).ok_or_else(|| {
        "Unknown application id. AERA only opens explicitly whitelisted applications.".to_string()
    })?;
    Ok(app_status(app))
}

#[cfg(target_os = "macos")]
fn launch(app: AppSpec, path: &Path) -> Result<(), String> {
    let status = Command::new("/usr/bin/open")
        .arg(path)
        .status()
        .map_err(|error| format!("Could not launch {}: {error}", app.name))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!(
            "macOS returned exit status {status} while launching {}.",
            app.name
        ))
    }
}

#[cfg(target_os = "windows")]
fn launch(app: AppSpec, path: &Path) -> Result<(), String> {
    Command::new(path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Could not launch {}: {error}", app.name))
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn launch(app: AppSpec, _path: &Path) -> Result<(), String> {
    Err(format!(
        "{} launch is currently supported on macOS and/or Windows only.",
        app.name
    ))
}

pub fn open(app_id: &str) -> Result<(), String> {
    let app = spec(app_id)
        .ok_or_else(|| "Unknown application id. Arbitrary process execution is not allowed.".to_string())?;

    #[cfg(target_os = "windows")]
    if app.id == "logic" {
        return Err("Logic Pro is only available on macOS.".into());
    }

    let path = find_existing(candidates(app))
        .ok_or_else(|| format!("{} was not found in a supported install location.", app.name))?;
    launch(app, &path)
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
    fn stable_daw_identities_exist() {
        for (id, name) in [
            ("reaper", "REAPER"),
            ("flstudio", "FL Studio"),
            ("protools", "Pro Tools"),
            ("logic", "Logic Pro"),
            ("ableton", "Ableton Live"),
        ] {
            let status = status(id).unwrap();
            assert_eq!(status.id, id);
            assert_eq!(status.name, name);
        }
    }
}
