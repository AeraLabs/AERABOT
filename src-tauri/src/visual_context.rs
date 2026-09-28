use image::{DynamicImage, ImageFormat};
use serde::Serialize;
use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use xcap::Window;

static VISUAL_CONTEXT_ENABLED: AtomicBool = AtomicBool::new(false);
const MAX_CAPTURE_WIDTH: u32 = 1280;
const MAX_CAPTURE_HEIGHT: u32 = 900;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualContextStatus {
    pub supported: bool,
    pub enabled: bool,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualCapture {
    pub app_name: String,
    pub title: String,
    pub process_id: u32,
    pub width: u32,
    pub height: u32,
    pub png: Vec<u8>,
}

pub fn status() -> VisualContextStatus {
    VisualContextStatus {
        supported: cfg!(any(target_os = "macos", target_os = "windows")),
        enabled: VISUAL_CONTEXT_ENABLED.load(Ordering::SeqCst),
        mode: "explicit-focused-window".into(),
    }
}

pub fn set_enabled(enabled: bool) -> VisualContextStatus {
    VISUAL_CONTEXT_ENABLED.store(enabled, Ordering::SeqCst);
    status()
}

fn matches_target(window: &Window, process_id: Option<u32>, title: Option<&str>) -> bool {
    let pid = match window.pid() {
        Ok(pid) => pid,
        Err(_) => return false,
    };
    if pid == std::process::id() {
        return false;
    }
    if let Some(expected_pid) = process_id {
        if pid != expected_pid {
            return false;
        }
    }
    if let Some(expected_title) = title.filter(|value| !value.trim().is_empty()) {
        if let Ok(candidate) = window.title() {
            if candidate != expected_title {
                return false;
            }
        }
    }
    true
}

pub fn capture(process_id: Option<u32>, title: Option<&str>) -> Result<VisualCapture, String> {
    if !VISUAL_CONTEXT_ENABLED.load(Ordering::SeqCst) {
        return Err("Visual Context is disabled. Enable it explicitly before asking AERA to look at a window.".into());
    }

    let windows = Window::all()
        .map_err(|error| format!("Could not enumerate windows for Visual Context: {error}"))?;

    let window = if process_id.is_some() {
        windows
            .into_iter()
            .find(|window| matches_target(window, process_id, title))
    } else {
        windows.into_iter().find(|window| {
            matches_target(window, None, title)
                && window.is_focused().unwrap_or(false)
        })
    }
    .ok_or_else(|| "The previously focused external window is no longer available for capture.".to_string())?;

    if window.is_minimized().unwrap_or(false) {
        return Err("The requested window is minimized and cannot be captured.".into());
    }

    let app_name = window.app_name().unwrap_or_else(|_| "Application".into());
    let window_title = window.title().unwrap_or_default();
    let pid = window.pid().map_err(|error| error.to_string())?;
    let image = window.capture_image().map_err(|error| {
        format!(
            "Window capture failed. On macOS, verify Screen Recording permission for AERA. {error}"
        )
    })?;

    let resized = DynamicImage::ImageRgba8(image)
        .thumbnail(MAX_CAPTURE_WIDTH, MAX_CAPTURE_HEIGHT);
    let width = resized.width();
    let height = resized.height();
    let mut cursor = Cursor::new(Vec::new());
    resized
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| format!("Could not encode the local visual capture: {error}"))?;

    Ok(VisualCapture {
        app_name,
        title: window_title,
        process_id: pid,
        width,
        height,
        png: cursor.into_inner(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn visual_context_is_opt_in() {
        set_enabled(false);
        assert!(!status().enabled);
        set_enabled(true);
        assert!(status().enabled);
        set_enabled(false);
    }
}
