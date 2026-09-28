use serde::Serialize;
use tauri::{LogicalPosition, LogicalSize, WebviewWindow};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemProfile {
    platform: String,
    architecture: String,
    renderer: String,
    ai_runtime: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorSnapshot {
    name: Option<String>,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
}

fn ai_runtime_for_arch(arch: &str) -> &'static str {
    match arch {
        "aarch64" => "AERA Accelerated",
        "x86_64" => "AERA Standard / CPU fallback",
        _ => "AERA Lite",
    }
}

#[tauri::command]
fn system_profile() -> SystemProfile {
    let arch = std::env::consts::ARCH;
    let os = std::env::consts::OS;
    SystemProfile {
        platform: match os {
            "macos" => "macOS".into(),
            "windows" => "Windows".into(),
            other => other.into(),
        },
        architecture: arch.into(),
        renderer: match os {
            "macos" => "WebKit/WebGL · Metal-backed where available".into(),
            "windows" => "WebView2/WebGL · system GPU".into(),
            _ => "WebGL".into(),
        },
        ai_runtime: ai_runtime_for_arch(arch).into(),
    }
}

#[tauri::command]
fn set_click_through(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(enabled).map_err(|error| error.to_string())
}

#[tauri::command]
fn set_orb_size(window: WebviewWindow, diameter: f64) -> Result<(), String> {
    let diameter = diameter.clamp(72.0, 420.0);
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let old_position = window.outer_position().map_err(|error| error.to_string())?;
    let old_size = window.outer_size().map_err(|error| error.to_string())?;
    let old_center_x = old_position.x as f64 + old_size.width as f64 / 2.0;
    let old_center_y = old_position.y as f64 + old_size.height as f64 / 2.0;
    let new_physical = diameter * scale;

    window.set_size(LogicalSize::new(diameter, diameter)).map_err(|error| error.to_string())?;
    window.set_position(LogicalPosition::new(
        (old_center_x - new_physical / 2.0) / scale,
        (old_center_y - new_physical / 2.0) / scale,
    )).map_err(|error| error.to_string())
}

#[tauri::command]
fn move_orb(window: WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window.set_position(LogicalPosition::new(x, y)).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_monitors(window: WebviewWindow) -> Result<Vec<MonitorSnapshot>, String> {
    let monitors = window.available_monitors().map_err(|error| error.to_string())?;
    Ok(monitors.into_iter().map(|monitor| {
        let position = monitor.position();
        let size = monitor.size();
        MonitorSnapshot {
            name: monitor.name().map(ToOwned::to_owned),
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            scale_factor: monitor.scale_factor(),
        }
    }).collect())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system_profile,
            set_click_through,
            set_orb_size,
            move_orb,
            list_monitors
        ])
        .run(tauri::generate_context!())
        .expect("error while running AERA Orb");
}
