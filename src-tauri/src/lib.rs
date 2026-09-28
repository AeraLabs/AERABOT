mod desktop_apps;
mod foreground;
mod local_ai;
mod position;
mod reaper_osc;
mod speech;

use local_ai::{LocalChatRequest, LocalChatResponse, LocalProviderStatus};
use serde::Serialize;
use speech::SpeechStatus;
use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewWindow};

#[cfg(any(target_os = "macos", target_os = "windows"))]
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

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
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_orb_size(window: WebviewWindow, diameter: f64) -> Result<(), String> {
    let diameter = diameter.clamp(72.0, 560.0);
    let scale = window.scale_factor().map_err(|error| error.to_string())?;
    let old_position = window.outer_position().map_err(|error| error.to_string())?;
    let old_size = window.outer_size().map_err(|error| error.to_string())?;
    let old_center_x = old_position.x as f64 + old_size.width as f64 / 2.0;
    let old_center_y = old_position.y as f64 + old_size.height as f64 / 2.0;
    let new_physical = diameter * scale;

    window
        .set_size(LogicalSize::new(diameter, diameter))
        .map_err(|error| error.to_string())?;
    window
        .set_position(LogicalPosition::new(
            (old_center_x - new_physical / 2.0) / scale,
            (old_center_y - new_physical / 2.0) / scale,
        ))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn move_orb(window: WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn list_monitors(window: WebviewWindow) -> Result<Vec<MonitorSnapshot>, String> {
    let monitors = window
        .available_monitors()
        .map_err(|error| error.to_string())?;
    Ok(monitors
        .into_iter()
        .map(|monitor| {
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
        })
        .collect())
}

#[tauri::command]
async fn probe_local_ai() -> Result<Vec<LocalProviderStatus>, String> {
    local_ai::probe().await
}

#[tauri::command]
async fn local_chat(request: LocalChatRequest) -> Result<LocalChatResponse, String> {
    local_ai::chat(request).await
}

#[tauri::command]
async fn probe_local_speech() -> Result<SpeechStatus, String> {
    speech::probe().await
}

#[tauri::command]
async fn transcribe_audio(audio: Vec<u8>) -> Result<String, String> {
    speech::transcribe(audio).await
}

#[tauri::command]
async fn synthesize_speech(text: String) -> Result<Vec<u8>, String> {
    speech::synthesize(text).await
}

#[tauri::command]
fn known_app_status(app_id: String) -> Result<desktop_apps::KnownAppStatus, String> {
    desktop_apps::status(&app_id)
}

#[tauri::command]
fn open_known_app(app_id: String) -> Result<(), String> {
    desktop_apps::open(&app_id)
}

#[tauri::command]
fn reaper_osc_status() -> reaper_osc::ReaperOscStatus {
    reaper_osc::status()
}

#[tauri::command]
fn reaper_transport(action: String) -> Result<(), String> {
    reaper_osc::transport(&action)
}

#[tauri::command]
fn foreground_window_snapshot() -> foreground::ForegroundWindowSnapshot {
    foreground::snapshot()
}

#[cfg(target_os = "macos")]
fn summon_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space)
}

#[cfg(target_os = "windows")]
fn summon_shortcut() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
fn install_global_shortcut(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(|app, _shortcut, event| {
                if event.state() != ShortcutState::Pressed {
                    return;
                }
                if let Some(window) = app.get_webview_window("orb") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                let _ = app.emit("aera-summon", ());
            })
            .build(),
    )?;

    app.global_shortcut().register(summon_shortcut())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            install_global_shortcut(app)?;

            if let Some(window) = app.get_webview_window("orb") {
                let _ = position::restore(&window);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Moved(position) = event {
                let _ = position::save(window.app_handle(), *position);
            }
        })
        .invoke_handler(tauri::generate_handler![
            system_profile,
            set_click_through,
            set_orb_size,
            move_orb,
            list_monitors,
            probe_local_ai,
            local_chat,
            probe_local_speech,
            transcribe_audio,
            synthesize_speech,
            known_app_status,
            open_known_app,
            reaper_osc_status,
            reaper_transport,
            foreground_window_snapshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running AERA Orb");
}
