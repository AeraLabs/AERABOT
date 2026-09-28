use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundWindowSnapshot {
    pub available: bool,
    pub app_name: Option<String>,
    pub app_id: Option<String>,
    pub process_id: Option<u32>,
    pub title: Option<String>,
    pub bounds: Option<WindowBounds>,
    pub minimized: Option<bool>,
    pub maximized: Option<bool>,
    pub fullscreen: Option<bool>,
    pub coordinate_space: String,
    pub geometry_source: String,
    pub permission_required: bool,
    pub permission_granted: bool,
    pub is_aera: bool,
    pub error: Option<String>,
}

impl ForegroundWindowSnapshot {
    fn unavailable(error: impl Into<String>) -> Self {
        Self {
            available: false,
            app_name: None,
            app_id: None,
            process_id: None,
            title: None,
            bounds: None,
            minimized: None,
            maximized: None,
            fullscreen: None,
            coordinate_space: "logical".into(),
            geometry_source: "none".into(),
            permission_required: false,
            permission_granted: false,
            is_aera: false,
            error: Some(error.into()),
        }
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use super::{ForegroundWindowSnapshot, WindowBounds};
    use std::mem::{size_of, zeroed};
    use std::path::Path;
    use windows_sys::Win32::Foundation::{CloseHandle, RECT};
    use windows_sys::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
    use windows_sys::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsIconic, IsZoomed,
    };

    fn window_title(hwnd: isize) -> Option<String> {
        unsafe {
            let len = GetWindowTextLengthW(hwnd as _);
            if len <= 0 {
                return None;
            }

            let mut buffer = vec![0_u16; len as usize + 1];
            let copied = GetWindowTextW(hwnd as _, buffer.as_mut_ptr(), buffer.len() as i32);
            if copied <= 0 {
                return None;
            }

            Some(String::from_utf16_lossy(&buffer[..copied as usize]))
        }
    }

    fn process_path(pid: u32) -> Option<String> {
        unsafe {
            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if handle.is_null() {
                return None;
            }

            let mut buffer = vec![0_u16; 32768];
            let mut len = buffer.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut len);
            let _ = CloseHandle(handle);
            if ok == 0 || len == 0 {
                return None;
            }

            Some(String::from_utf16_lossy(&buffer[..len as usize]))
        }
    }

    pub fn snapshot() -> ForegroundWindowSnapshot {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return ForegroundWindowSnapshot::unavailable(
                    "Windows did not report a foreground window.",
                );
            }

            let mut pid = 0_u32;
            GetWindowThreadProcessId(hwnd, &mut pid);

            let mut rect: RECT = zeroed();
            let hr = DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                (&mut rect as *mut RECT).cast(),
                size_of::<RECT>() as u32,
            );

            let bounds = if hr >= 0 && rect.right > rect.left && rect.bottom > rect.top {
                Some(WindowBounds {
                    x: rect.left as f64,
                    y: rect.top as f64,
                    width: (rect.right - rect.left) as f64,
                    height: (rect.bottom - rect.top) as f64,
                })
            } else {
                None
            };

            let path = process_path(pid);
            let app_name = path.as_deref().and_then(|value| {
                Path::new(value)
                    .file_stem()
                    .map(|stem| stem.to_string_lossy().into_owned())
            });

            ForegroundWindowSnapshot {
                available: true,
                app_name,
                app_id: path,
                process_id: Some(pid),
                title: window_title(hwnd as isize),
                bounds,
                minimized: Some(IsIconic(hwnd) != 0),
                maximized: Some(IsZoomed(hwnd) != 0),
                // Maximized is not equivalent to fullscreen. A future Windows
                // monitor comparison can populate true fullscreen state.
                fullscreen: None,
                coordinate_space: "physical".into(),
                geometry_source: "win32-dwm".into(),
                permission_required: false,
                permission_granted: true,
                is_aera: pid == std::process::id(),
                error: None,
            }
        }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::{ForegroundWindowSnapshot, WindowBounds};
    use axuielement::{is_process_trusted, system_wide};
    use objc2_app_kit::NSWorkspace;

    fn frontmost_identity() -> (Option<String>, Option<String>, Option<u32>) {
        let workspace = NSWorkspace::sharedWorkspace();
        let Some(app) = workspace.frontmostApplication() else {
            return (None, None, None);
        };

        let name = app.localizedName().map(|value| value.to_string());
        let bundle = app.bundleIdentifier().map(|value| value.to_string());
        let pid = app.processIdentifier();
        let pid = (pid > 0).then_some(pid as u32);
        (name, bundle, pid)
    }

    pub fn snapshot() -> ForegroundWindowSnapshot {
        let (app_name, app_id, process_id) = frontmost_identity();
        if app_name.is_none() && process_id.is_none() {
            return ForegroundWindowSnapshot::unavailable(
                "macOS did not report a frontmost application.",
            );
        }

        let trusted = is_process_trusted();
        let mut title = None;
        let mut bounds = None;
        let mut minimized = None;
        let maximized = None;
        let mut fullscreen = None;
        let mut geometry_error = None;

        if trusted {
            match system_wide().and_then(|system| system.focused_window().ok().flatten()) {
                Some(window) => {
                    title = window.string_attribute("AXTitle").ok().flatten();
                    minimized = window.bool_attribute("AXMinimized").ok().flatten();
                    fullscreen = window.bool_attribute("AXFullScreen").ok().flatten();

                    let position = window.point_attribute("AXPosition").ok().flatten();
                    let size = window.size_attribute("AXSize").ok().flatten();
                    if let (Some(position), Some(size)) = (position, size) {
                        if size.width > 0.0 && size.height > 0.0 {
                            bounds = Some(WindowBounds {
                                x: position.x,
                                y: position.y,
                                width: size.width,
                                height: size.height,
                            });
                        }
                    }
                }
                None => {
                    geometry_error =
                        Some("The focused macOS window is not exposed through Accessibility.".into());
                }
            }
        }

        ForegroundWindowSnapshot {
            available: true,
            app_name,
            app_id,
            process_id,
            title,
            bounds,
            minimized,
            maximized,
            fullscreen,
            coordinate_space: "logical".into(),
            geometry_source: if trusted {
                "macos-accessibility".into()
            } else {
                "none".into()
            },
            permission_required: true,
            permission_granted: trusted,
            is_aera: process_id == Some(std::process::id()),
            error: if trusted {
                geometry_error
            } else {
                Some(
                    "Window geometry requires macOS Accessibility permission; app identity remains available."
                        .into(),
                )
            },
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    use super::ForegroundWindowSnapshot;

    pub fn snapshot() -> ForegroundWindowSnapshot {
        ForegroundWindowSnapshot::unavailable(
            "Foreground window awareness is currently implemented on macOS and Windows.",
        )
    }
}

pub fn snapshot() -> ForegroundWindowSnapshot {
    platform::snapshot()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unavailable_snapshot_is_explicit() {
        let snapshot = ForegroundWindowSnapshot::unavailable("test");
        assert!(!snapshot.available);
        assert_eq!(snapshot.geometry_source, "none");
        assert_eq!(snapshot.error.as_deref(), Some("test"));
    }
}
