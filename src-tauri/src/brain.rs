use reqwest::Client;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::{Read, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const MODEL_ALIAS: &str = "aera-core-tiny";
const MODEL_LABEL: &str = "AERA Core Tiny";
const MODEL_DETAIL: &str = "Qwen3 0.6B · Q4_K_M";
const MODEL_LICENSE: &str = "Apache-2.0";
const MODEL_FILE: &str = "Qwen3-0.6B-Q4_K_M.gguf";
const MODEL_URL: &str = "https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/1208e45d782fe18602c5eaf10e5758d5b0f24c03/Qwen3-0.6B-Q4_K_M.gguf?download=true";
const MODEL_SHA256: &str = "b0638f08417a2d3c8652760462eb5407c6e30173cf9608ad0820757a281eea0e";

const LLAMA_BUILD: &str = "b11269";
const LLAMA_LICENSE: &str = "MIT";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrainStatus {
    pub state: String,
    pub message: String,
    pub ready: bool,
    pub installed: bool,
    pub progress: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub model: String,
    pub model_detail: String,
    pub model_license: String,
    pub runtime: String,
    pub runtime_license: String,
    pub port: Option<u16>,
    pub error: Option<String>,
}

impl Default for BrainStatus {
    fn default() -> Self {
        Self {
            state: "NEEDS_SETUP".into(),
            message: "AERA's local brain is not prepared yet.".into(),
            ready: false,
            installed: false,
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: 0,
            model: MODEL_LABEL.into(),
            model_detail: MODEL_DETAIL.into(),
            model_license: MODEL_LICENSE.into(),
            runtime: format!("llama.cpp {LLAMA_BUILD}"),
            runtime_license: LLAMA_LICENSE.into(),
            port: None,
            error: None,
        }
    }
}

#[derive(Debug, Clone, Copy)]
struct RuntimeSpec {
    archive_name: &'static str,
    url: &'static str,
    sha256: &'static str,
}

#[derive(Default)]
struct BrainProcess {
    child: Option<Child>,
    port: Option<u16>,
}

static STATUS: OnceLock<Mutex<BrainStatus>> = OnceLock::new();
static PROCESS: OnceLock<Mutex<BrainProcess>> = OnceLock::new();
static PREPARING: AtomicBool = AtomicBool::new(false);

fn status_cell() -> &'static Mutex<BrainStatus> {
    STATUS.get_or_init(|| Mutex::new(BrainStatus::default()))
}

fn process_cell() -> &'static Mutex<BrainProcess> {
    PROCESS.get_or_init(|| Mutex::new(BrainProcess::default()))
}

fn mutate_status(update: impl FnOnce(&mut BrainStatus)) {
    if let Ok(mut status) = status_cell().lock() {
        update(&mut status);
    }
}

fn set_stage(state: &str, message: impl Into<String>) {
    let message = message.into();
    mutate_status(|status| {
        status.state = state.into();
        status.message = message;
        status.ready = false;
        status.error = None;
        status.progress = 0.0;
        status.downloaded_bytes = 0;
        status.total_bytes = 0;
    });
}

fn runtime_spec() -> Result<RuntimeSpec, String> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "x86_64") => Ok(RuntimeSpec {
            archive_name: "llama-b11269-bin-macos-x64.tar.gz",
            url: "https://github.com/ggml-org/llama.cpp/releases/download/b11269/llama-b11269-bin-macos-x64.tar.gz",
            sha256: "7dd80f531d096cbaa66dc95878afd8e57350bc0a43e8953d06269ce706392a9e",
        }),
        ("macos", "aarch64") => Ok(RuntimeSpec {
            archive_name: "llama-b11269-bin-macos-arm64.tar.gz",
            url: "https://github.com/ggml-org/llama.cpp/releases/download/b11269/llama-b11269-bin-macos-arm64.tar.gz",
            sha256: "294fc3148359cf56ecddf94a84b66922025c2ab87a464fe6fcfcefd737159777",
        }),
        ("windows", "x86_64") => Ok(RuntimeSpec {
            archive_name: "llama-b11269-bin-win-cpu-x64.zip",
            url: "https://github.com/ggml-org/llama.cpp/releases/download/b11269/llama-b11269-bin-win-cpu-x64.zip",
            sha256: "a15b798c282d70b169df4034e002fd2fad43437b2267503c1cffbbd8e4202a1c",
        }),
        (os, arch) => Err(format!(
            "AERA Brain does not have a bundled runtime for {os}/{arch} yet."
        )),
    }
}

fn brain_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("brain"))
        .map_err(|error| format!("Could not resolve AERA application data: {error}"))
}

fn marker_path(path: &Path) -> PathBuf {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("download");
    path.with_file_name(format!("{name}.sha256"))
}

fn sha256_file(path: &Path) -> Result<String, String> {
    let file = File::open(path)
        .map_err(|error| format!("Could not open {} for verification: {error}", path.display()))?;
    let mut reader = std::io::BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];

    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| format!("Could not verify {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn mark_verified(path: &Path, checksum: &str) -> Result<(), String> {
    fs::write(marker_path(path), checksum.as_bytes())
        .map_err(|error| format!("Could not save verification marker: {error}"))
}

fn verified(path: &Path, expected_sha256: &str) -> Result<bool, String> {
    if !path.is_file() {
        return Ok(false);
    }

    let marker = marker_path(path);
    if let Ok(saved) = fs::read_to_string(&marker) {
        if saved.trim().eq_ignore_ascii_case(expected_sha256) {
            return Ok(true);
        }
    }

    let actual = sha256_file(path)?;
    if !actual.eq_ignore_ascii_case(expected_sha256) {
        return Ok(false);
    }

    mark_verified(path, expected_sha256)?;
    Ok(true)
}

async fn download_verified(
    url: &str,
    destination: &Path,
    expected_sha256: &str,
    state: &str,
    message: &str,
) -> Result<(), String> {
    if verified(destination, expected_sha256)? {
        return Ok(());
    }

    if destination.exists() {
        let _ = fs::remove_file(destination);
    }
    let _ = fs::remove_file(marker_path(destination));

    let parent = destination
        .parent()
        .ok_or_else(|| "AERA download destination has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create AERA brain folder: {error}"))?;

    let partial = destination.with_file_name(format!(
        "{}.part",
        destination
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("download")
    ));
    let _ = fs::remove_file(&partial);

    let http = Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(30 * 60))
        .user_agent("AERA-Desktop/0.1")
        .build()
        .map_err(|error| error.to_string())?;

    let mut response = http
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Could not download AERA Brain component: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "AERA Brain download returned HTTP {}.",
            response.status()
        ));
    }

    let total = response.content_length().unwrap_or(0);
    mutate_status(|status| {
        status.state = state.into();
        status.message = message.into();
        status.ready = false;
        status.error = None;
        status.progress = 0.0;
        status.downloaded_bytes = 0;
        status.total_bytes = total;
    });

    let mut file = File::create(&partial)
        .map_err(|error| format!("Could not create AERA Brain download: {error}"))?;
    let mut downloaded = 0_u64;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("AERA Brain download was interrupted: {error}"))?
    {
        file.write_all(&chunk)
            .map_err(|error| format!("Could not save AERA Brain download: {error}"))?;
        downloaded += chunk.len() as u64;
        mutate_status(|status| {
            status.downloaded_bytes = downloaded;
            status.total_bytes = total;
            status.progress = if total > 0 {
                (downloaded as f64 / total as f64).clamp(0.0, 1.0)
            } else {
                0.0
            };
        });
    }

    file.flush()
        .map_err(|error| format!("Could not finish AERA Brain download: {error}"))?;
    drop(file);

    mutate_status(|status| {
        status.state = "VERIFYING".into();
        status.message = "Verifying AERA's local brain…".into();
        status.progress = 1.0;
    });

    let actual = sha256_file(&partial)?;
    if !actual.eq_ignore_ascii_case(expected_sha256) {
        let _ = fs::remove_file(&partial);
        return Err(format!(
            "AERA Brain checksum verification failed. Expected {expected_sha256}, received {actual}."
        ));
    }

    fs::rename(&partial, destination)
        .map_err(|error| format!("Could not install AERA Brain component: {error}"))?;
    mark_verified(destination, expected_sha256)?;
    Ok(())
}

fn find_server(root: &Path) -> Option<PathBuf> {
    let expected = if cfg!(target_os = "windows") {
        "llama-server.exe"
    } else {
        "llama-server"
    };

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(found) = find_server(&path) {
                return Some(found);
            }
        } else if path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name == expected)
        {
            return Some(path);
        }
    }
    None
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let mut permissions = fs::metadata(path)
        .map_err(|error| format!("Could not read llama.cpp permissions: {error}"))?
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)
        .map_err(|error| format!("Could not mark llama.cpp executable: {error}"))
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn extract_runtime(archive: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|error| format!("Could not create AERA runtime directory: {error}"))?;

    #[cfg(target_os = "macos")]
    {
        let status = Command::new("/usr/bin/tar")
            .arg("-xzf")
            .arg(archive)
            .arg("-C")
            .arg(destination)
            .status()
            .map_err(|error| format!("Could not unpack AERA's llama.cpp runtime: {error}"))?;
        if !status.success() {
            return Err(format!(
                "Could not unpack AERA's llama.cpp runtime (exit {status})."
            ));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let archive = archive.to_string_lossy().replace('\'', "''");
        let destination = destination.to_string_lossy().replace('\'', "''");
        let script = format!(
            "Expand-Archive -LiteralPath '{archive}' -DestinationPath '{destination}' -Force"
        );
        let status = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .status()
            .map_err(|error| format!("Could not unpack AERA's llama.cpp runtime: {error}"))?;
        if !status.success() {
            return Err(format!(
                "Could not unpack AERA's llama.cpp runtime (exit {status})."
            ));
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = archive;
        return Err("AERA Brain runtime extraction is not implemented on this platform.".into());
    }

    Ok(())
}

async fn ensure_runtime(app: &AppHandle) -> Result<PathBuf, String> {
    let root = brain_root(app)?;
    let runtime = runtime_spec()?;
    let runtime_dir = root.join("runtime").join(LLAMA_BUILD);
    let runtime_marker = runtime_dir.join(".aera-verified");

    if runtime_marker.is_file() {
        if let Ok(saved) = fs::read_to_string(&runtime_marker) {
            if saved.trim().eq_ignore_ascii_case(runtime.sha256) {
                if let Some(server) = find_server(&runtime_dir) {
                    make_executable(&server)?;
                    return Ok(server);
                }
            }
        }
    }

    set_stage(
        "DOWNLOADING",
        "Preparing AERA's local intelligence engine…",
    );

    let downloads = root.join("downloads");
    let archive = downloads.join(runtime.archive_name);
    download_verified(
        runtime.url,
        &archive,
        runtime.sha256,
        "DOWNLOADING",
        "Downloading AERA's local intelligence engine…",
    )
    .await?;

    mutate_status(|status| {
        status.state = "INSTALLING".into();
        status.message = "Installing AERA's local intelligence engine…".into();
        status.progress = 0.0;
        status.downloaded_bytes = 0;
        status.total_bytes = 0;
    });

    if runtime_dir.exists() {
        fs::remove_dir_all(&runtime_dir)
            .map_err(|error| format!("Could not replace AERA runtime: {error}"))?;
    }
    extract_runtime(&archive, &runtime_dir)?;

    let server = find_server(&runtime_dir)
        .ok_or_else(|| "The AERA runtime archive did not contain llama-server.".to_string())?;
    make_executable(&server)?;
    fs::write(&runtime_marker, runtime.sha256.as_bytes())
        .map_err(|error| format!("Could not mark AERA runtime verified: {error}"))?;

    let _ = fs::remove_file(&archive);
    let _ = fs::remove_file(marker_path(&archive));
    Ok(server)
}

async fn ensure_model(app: &AppHandle) -> Result<PathBuf, String> {
    let root = brain_root(app)?;
    let model = root.join("models").join(MODEL_FILE);

    if verified(&model, MODEL_SHA256)? {
        return Ok(model);
    }

    download_verified(
        MODEL_URL,
        &model,
        MODEL_SHA256,
        "DOWNLOADING",
        "Downloading AERA's local brain…",
    )
    .await?;

    Ok(model)
}

fn available_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Could not reserve a private AERA Brain port: {error}"))?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|error| error.to_string())
}

fn process_alive() -> bool {
    let mut process = match process_cell().lock() {
        Ok(process) => process,
        Err(_) => return false,
    };

    let Some(child) = process.child.as_mut() else {
        return false;
    };

    match child.try_wait() {
        Ok(None) => true,
        Ok(Some(_)) | Err(_) => {
            process.child = None;
            process.port = None;
            false
        }
    }
}

fn spawn_server(app: &AppHandle, server: &Path, model: &Path) -> Result<u16, String> {
    shutdown();

    let port = available_port()?;
    let threads = std::thread::available_parallelism()
        .map(|value| value.get().saturating_sub(1).clamp(2, 8))
        .unwrap_or(2);

    let root = brain_root(app)?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create AERA Brain directory: {error}"))?;
    let log = File::create(root.join("llama-server.log"))
        .map_err(|error| format!("Could not create AERA Brain log: {error}"))?;

    let mut command = Command::new(server);
    command
        .arg("-m")
        .arg(model)
        .arg("--alias")
        .arg(MODEL_ALIAS)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .arg("-c")
        .arg("4096")
        .arg("-t")
        .arg(threads.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::from(log));

    if let Some(parent) = server.parent() {
        command.current_dir(parent);
        #[cfg(target_os = "macos")]
        command.env("DYLD_LIBRARY_PATH", parent);
    }

    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        command.arg("-ngl").arg("99");
    }

    let child = command
        .spawn()
        .map_err(|error| format!("Could not start AERA's local brain: {error}"))?;

    let mut process = process_cell()
        .lock()
        .map_err(|_| "AERA Brain process state is unavailable.".to_string())?;
    process.child = Some(child);
    process.port = Some(port);
    Ok(port)
}

async fn wait_until_ready(port: u16) -> Result<(), String> {
    let http = Client::builder()
        .connect_timeout(Duration::from_secs(1))
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|error| error.to_string())?;
    let started = Instant::now();
    let url = format!("http://127.0.0.1:{port}/health");

    while started.elapsed() < Duration::from_secs(120) {
        if !process_alive() {
            return Err(
                "AERA's local brain stopped while loading. Open Diagnostics for the local log."
                    .into(),
            );
        }

        if let Ok(response) = http.get(&url).send().await {
            if response.status().is_success() {
                return Ok(());
            }
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Err("AERA's local brain took too long to load.".into())
}

async fn ensure_inner(app: &AppHandle) -> Result<BrainStatus, String> {
    if status().ready {
        return Ok(status());
    }

    let server = ensure_runtime(app).await?;
    let model = ensure_model(app).await?;

    mutate_status(|status| {
        status.state = "STARTING".into();
        status.message = "Starting AERA's local brain…".into();
        status.ready = false;
        status.installed = true;
        status.progress = 0.0;
        status.downloaded_bytes = 0;
        status.total_bytes = 0;
    });

    let port = spawn_server(app, &server, &model)?;
    mutate_status(|status| {
        status.state = "LOADING".into();
        status.message = "Loading AERA's local brain…".into();
        status.port = Some(port);
    });

    wait_until_ready(port).await?;

    mutate_status(|status| {
        status.state = "READY".into();
        status.message = "AERA Brain is ready.".into();
        status.ready = true;
        status.installed = true;
        status.progress = 1.0;
        status.downloaded_bytes = 0;
        status.total_bytes = 0;
        status.port = Some(port);
        status.error = None;
    });

    Ok(status())
}

async fn run_prepare(app: AppHandle, reset: bool) -> Result<BrainStatus, String> {
    if PREPARING.swap(true, Ordering::SeqCst) {
        return Ok(status());
    }

    let result = async {
        if reset {
            shutdown();
            let root = brain_root(&app)?;
            if root.exists() {
                fs::remove_dir_all(&root)
                    .map_err(|error| format!("Could not reset AERA Brain: {error}"))?;
            }
            mutate_status(|status| *status = BrainStatus::default());
        }

        ensure_inner(&app).await
    }
    .await;

    PREPARING.store(false, Ordering::SeqCst);

    match result {
        Ok(status) => Ok(status),
        Err(error) => {
            let installed = brain_root(&app)
                .ok()
                .is_some_and(|root| root.join("models").join(MODEL_FILE).is_file());
            mutate_status(|status| {
                status.state = "ERROR".into();
                status.message = "I couldn't finish preparing my local brain.".into();
                status.ready = false;
                status.installed = installed;
                status.progress = 0.0;
                status.downloaded_bytes = 0;
                status.total_bytes = 0;
                status.port = None;
                status.error = Some(error.clone());
            });
            Err(error)
        }
    }
}

pub async fn ensure(app: AppHandle) -> Result<BrainStatus, String> {
    run_prepare(app, false).await
}

pub async fn repair(app: AppHandle) -> Result<BrainStatus, String> {
    run_prepare(app, true).await
}

pub fn status() -> BrainStatus {
    let died = {
        let mut process = match process_cell().lock() {
            Ok(process) => process,
            Err(_) => {
                return status_cell()
                    .lock()
                    .map(|status| status.clone())
                    .unwrap_or_default();
            }
        };

        if let Some(child) = process.child.as_mut() {
            match child.try_wait() {
                Ok(Some(exit)) => {
                    process.child = None;
                    process.port = None;
                    Some(format!("AERA Brain exited with {exit}."))
                }
                Err(error) => {
                    process.child = None;
                    process.port = None;
                    Some(format!("Could not inspect AERA Brain: {error}"))
                }
                Ok(None) => None,
            }
        } else {
            None
        }
    };

    if let Some(error) = died {
        mutate_status(|status| {
            status.state = "OFFLINE".into();
            status.message = "AERA's brain stopped. I'm ready to restart it.".into();
            status.ready = false;
            status.port = None;
            status.error = Some(error);
        });
    }

    status_cell()
        .lock()
        .map(|status| status.clone())
        .unwrap_or_default()
}

pub fn endpoint() -> Option<String> {
    if !status().ready {
        return None;
    }

    process_cell()
        .lock()
        .ok()
        .and_then(|process| process.port)
        .map(|port| format!("http://127.0.0.1:{port}"))
}

pub fn model_alias() -> &'static str {
    MODEL_ALIAS
}

pub fn shutdown() {
    if let Ok(mut process) = process_cell().lock() {
        if let Some(mut child) = process.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        process.port = None;
    }

    mutate_status(|status| {
        if status.ready {
            status.state = "SLEEPING".into();
            status.message = "AERA Brain is sleeping.".into();
        }
        status.ready = false;
        status.port = None;
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_brain_is_not_falsely_ready() {
        let status = BrainStatus::default();
        assert!(!status.ready);
        assert!(!status.installed);
        assert_eq!(status.state, "NEEDS_SETUP");
    }

    #[test]
    fn runtime_manifest_supports_desktop_targets() {
        if matches!(std::env::consts::OS, "macos" | "windows") {
            let spec = runtime_spec().expect("supported desktop runtime");
            assert!(!spec.url.is_empty());
            assert_eq!(spec.sha256.len(), 64);
        }
    }
}
