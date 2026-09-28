use reqwest::{multipart, Client};
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;

const WHISPER_BASE: &str = "http://127.0.0.1:8081";
const PIPER_BASE: &str = "http://127.0.0.1:5000";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechStatus {
    pub whisper_available: bool,
    pub piper_available: bool,
    pub whisper_endpoint: String,
    pub piper_endpoint: String,
}

fn client(timeout_seconds: u64) -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|error| error.to_string())
}

pub async fn probe() -> Result<SpeechStatus, String> {
    let http = client(4)?;

    let whisper_available = http
        .get(format!("{WHISPER_BASE}/"))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false);

    let piper_available = http
        .get(format!("{PIPER_BASE}/info"))
        .send()
        .await
        .map(|response| response.status().is_success())
        .unwrap_or(false);

    Ok(SpeechStatus {
        whisper_available,
        piper_available,
        whisper_endpoint: WHISPER_BASE.into(),
        piper_endpoint: PIPER_BASE.into(),
    })
}

pub async fn transcribe(audio: Vec<u8>) -> Result<String, String> {
    if audio.len() < 44 {
        return Err("Recorded audio is empty.".into());
    }
    if audio.len() > 32 * 1024 * 1024 {
        return Err("Recorded audio is too large.".into());
    }

    let http = client(180)?;
    let part = multipart::Part::bytes(audio)
        .file_name("aera-command.wav")
        .mime_str("audio/wav")
        .map_err(|error| error.to_string())?;

    let form = multipart::Form::new()
        .part("file", part)
        .text("temperature", "0.0")
        .text("language", "auto")
        .text("response_format", "json");

    let response = http
        .post(format!("{WHISPER_BASE}/inference"))
        .multipart(form)
        .send()
        .await
        .map_err(|error| format!("whisper.cpp is unavailable: {error}"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format!("Could not read whisper.cpp response: {error}"))?;

    if !status.is_success() {
        return Err(format!("whisper.cpp returned HTTP {status}: {body}"));
    }

    let value: Value = serde_json::from_str(&body)
        .map_err(|error| format!("Invalid whisper.cpp response: {error}"))?;
    let text = value
        .get("text")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("whisper.cpp did not detect speech.".into());
    }

    Ok(text)
}

pub async fn synthesize(text: String) -> Result<Vec<u8>, String> {
    let clean = text.trim();
    if clean.is_empty() {
        return Err("There is nothing for AERA to say.".into());
    }

    let safe_text: String = clean.chars().take(1800).collect();
    let http = client(120)?;
    let response = http
        .post(format!("{PIPER_BASE}/synthesize"))
        .json(&json!({ "text": safe_text }))
        .send()
        .await
        .map_err(|error| format!("Piper is unavailable: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        let error = response.text().await.unwrap_or_default();
        return Err(format!("Piper returned HTTP {status}: {error}"));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Could not read Piper audio: {error}"))?;

    if bytes.is_empty() {
        return Err("Piper returned empty audio.".into());
    }

    Ok(bytes.to_vec())
}
