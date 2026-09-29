use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const OLLAMA_BASE: &str = "http://127.0.0.1:11434";
const LLAMA_CPP_BASE: &str = "http://127.0.0.1:8080";
const OPENAI_LOCAL_ENV: &str = "AERA_OPENAI_LOCAL_URL";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalProviderStatus {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub available: bool,
    pub models: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalChatRequest {
    pub provider: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVisionRequest {
    pub model: String,
    pub prompt: String,
    pub image_png: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalChatResponse {
    pub provider: String,
    pub model: String,
    pub content: String,
    pub thinking: Option<String>,
    pub elapsed_ms: u128,
}

fn client(timeout_seconds: u64) -> Result<Client, String> {
    Client::builder()
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|error| error.to_string())
}

fn normalize_loopback_base(raw: &str) -> Result<String, String> {
    let url = Url::parse(raw.trim()).map_err(|_| "Local OpenAI URL is invalid.".to_string())?;

    if url.scheme() != "http" {
        return Err("Local OpenAI URL must use http on loopback.".into());
    }

    if !url.username().is_empty() || url.password().is_some() {
        return Err("Credentials are not accepted in the local OpenAI URL.".into());
    }

    let host = url
        .host_str()
        .ok_or_else(|| "Local OpenAI URL has no host.".to_string())?;
    // url::Url may expose an IPv6 literal with brackets depending on the
    // parsed representation. Normalize only that syntax; the allowlist
    // remains restricted to explicit loopback hosts.
    let normalized_host = host
        .strip_prefix('[')
        .and_then(|value| value.strip_suffix(']'))
        .unwrap_or(host);

    if !matches!(normalized_host, "127.0.0.1" | "localhost" | "::1") {
        return Err("Local OpenAI URL must resolve to explicit loopback only.".into());
    }

    if url.query().is_some() || url.fragment().is_some() {
        return Err("Local OpenAI URL cannot contain a query or fragment.".into());
    }

    Ok(raw.trim().trim_end_matches('/').to_string())
}

fn configured_openai_base() -> Result<Option<String>, String> {
    match std::env::var(OPENAI_LOCAL_ENV) {
        Ok(raw) if !raw.trim().is_empty() => normalize_loopback_base(&raw).map(Some),
        _ => Ok(None),
    }
}

async fn probe_ollama(http: &Client) -> LocalProviderStatus {
    let endpoint = format!("{OLLAMA_BASE}/api/tags");
    match http.get(&endpoint).send().await {
        Ok(response) if response.status().is_success() => match response.json::<Value>().await {
            Ok(value) => {
                let models = value
                    .get("models")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|item| item.get("name").and_then(Value::as_str))
                    .map(ToOwned::to_owned)
                    .collect();
                LocalProviderStatus {
                    id: "ollama".into(),
                    name: "Ollama".into(),
                    endpoint: OLLAMA_BASE.into(),
                    available: true,
                    models,
                    error: None,
                }
            }
            Err(error) => LocalProviderStatus {
                id: "ollama".into(),
                name: "Ollama".into(),
                endpoint: OLLAMA_BASE.into(),
                available: true,
                models: vec![],
                error: Some(format!("Connected, but model discovery failed: {error}")),
            },
        },
        Ok(response) => LocalProviderStatus {
            id: "ollama".into(),
            name: "Ollama".into(),
            endpoint: OLLAMA_BASE.into(),
            available: false,
            models: vec![],
            error: Some(format!("HTTP {}", response.status())),
        },
        Err(error) => LocalProviderStatus {
            id: "ollama".into(),
            name: "Ollama".into(),
            endpoint: OLLAMA_BASE.into(),
            available: false,
            models: vec![],
            error: Some(error.to_string()),
        },
    }
}

async fn probe_openai_compatible(
    http: &Client,
    id: &str,
    name: &str,
    base: &str,
) -> LocalProviderStatus {
    let endpoint = format!("{base}/models");
    match http.get(&endpoint).send().await {
        Ok(response) if response.status().is_success() => match response.json::<Value>().await {
            Ok(value) => {
                let models = value
                    .get("data")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|item| item.get("id").and_then(Value::as_str))
                    .map(ToOwned::to_owned)
                    .collect();

                LocalProviderStatus {
                    id: id.into(),
                    name: name.into(),
                    endpoint: base.into(),
                    available: true,
                    models,
                    error: None,
                }
            }
            Err(error) => LocalProviderStatus {
                id: id.into(),
                name: name.into(),
                endpoint: base.into(),
                available: true,
                models: vec![],
                error: Some(format!("Connected, but model discovery failed: {error}")),
            },
        },
        Ok(response) => LocalProviderStatus {
            id: id.into(),
            name: name.into(),
            endpoint: base.into(),
            available: false,
            models: vec![],
            error: Some(format!("HTTP {}", response.status())),
        },
        Err(error) => LocalProviderStatus {
            id: id.into(),
            name: name.into(),
            endpoint: base.into(),
            available: false,
            models: vec![],
            error: Some(error.to_string()),
        },
    }
}

async fn chat_openai_compatible(
    http: &Client,
    provider: &str,
    base: &str,
    request: LocalChatRequest,
    started: Instant,
) -> Result<LocalChatResponse, String> {
    let response = http
        .post(format!("{base}/chat/completions"))
        .json(&json!({
            "model": request.model,
            "messages": request.messages,
            "temperature": 0.25,
            "max_tokens": 700,
            "stream": false
        }))
        .send()
        .await
        .map_err(|error| format!("{provider} is unavailable: {error}"))?;

    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Invalid {provider} response: {error}"))?;

    if !status.is_success() {
        return Err(value
            .get("error")
            .and_then(|error| {
                error
                    .get("message")
                    .and_then(Value::as_str)
                    .or_else(|| error.as_str())
            })
            .unwrap_or("Local OpenAI-compatible runtime returned an error.")
            .to_string());
    }

    let content = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        return Err(format!("{provider} returned an empty response."));
    }

    Ok(LocalChatResponse {
        provider: provider.into(),
        model: request.model,
        content,
        thinking: None,
        elapsed_ms: started.elapsed().as_millis(),
    })
}

pub async fn probe() -> Result<Vec<LocalProviderStatus>, String> {
    let http = client(5)?;
    let ollama = probe_ollama(&http).await;
    let llama_cpp = probe_openai_compatible(&http, "llamacpp", "llama.cpp", &format!("{LLAMA_CPP_BASE}/v1")).await;

    let openai_local = match configured_openai_base() {
        Ok(Some(base)) => probe_openai_compatible(&http, "openai_local", "OpenAI-compatible local", &base).await,
        Ok(None) => LocalProviderStatus {
            id: "openai_local".into(),
            name: "OpenAI-compatible local".into(),
            endpoint: format!("set {OPENAI_LOCAL_ENV}"),
            available: false,
            models: vec![],
            error: Some("Not configured.".into()),
        },
        Err(error) => LocalProviderStatus {
            id: "openai_local".into(),
            name: "OpenAI-compatible local".into(),
            endpoint: format!("set {OPENAI_LOCAL_ENV}"),
            available: false,
            models: vec![],
            error: Some(error),
        },
    };

    Ok(vec![ollama, llama_cpp, openai_local])
}

pub async fn vision(request: LocalVisionRequest) -> Result<LocalChatResponse, String> {
    if request.model.trim().is_empty() {
        return Err("Select a local Ollama vision model first.".into());
    }
    if request.prompt.trim().is_empty() {
        return Err("AERA needs a visual-context question.".into());
    }
    if request.image_png.is_empty() || request.image_png.len() > 12 * 1024 * 1024 {
        return Err("Visual capture is empty or too large.".into());
    }

    let http = client(180)?;
    let started = Instant::now();
    let encoded = BASE64.encode(&request.image_png);

    let response = http
        .post(format!("{OLLAMA_BASE}/api/chat"))
        .json(&json!({
            "model": request.model,
            "messages": [{
                "role": "user",
                "content": request.prompt,
                "images": [encoded]
            }],
            "stream": false
        }))
        .send()
        .await
        .map_err(|error| format!("Local Ollama vision is unavailable: {error}"))?;

    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .map_err(|error| format!("Invalid Ollama vision response: {error}"))?;

    if !status.is_success() {
        return Err(value
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or("The selected Ollama model could not analyze the image.")
            .to_string());
    }

    let content = value
        .pointer("/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();

    if content.is_empty() {
        return Err("The local vision model returned an empty response.".into());
    }

    Ok(LocalChatResponse {
        provider: "ollama".into(),
        model: request.model,
        content,
        thinking: value
            .pointer("/message/thinking")
            .and_then(Value::as_str)
            .map(ToOwned::to_owned),
        elapsed_ms: started.elapsed().as_millis(),
    })
}

pub async fn chat(request: LocalChatRequest) -> Result<LocalChatResponse, String> {
    if request.model.trim().is_empty() {
        return Err("No local model selected.".into());
    }
    if request.messages.is_empty() {
        return Err("AERA cannot call a model without a message.".into());
    }

    let http = client(180)?;
    let started = Instant::now();

    match request.provider.as_str() {
        "ollama" => {
            let response = http
                .post(format!("{OLLAMA_BASE}/api/chat"))
                .json(&json!({
                    "model": request.model,
                    "messages": request.messages,
                    "stream": false
                }))
                .send()
                .await
                .map_err(|error| format!("Ollama is unavailable: {error}"))?;

            let status = response.status();
            let value = response
                .json::<Value>()
                .await
                .map_err(|error| format!("Invalid Ollama response: {error}"))?;

            if !status.is_success() {
                return Err(value
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("Ollama returned an error.")
                    .to_string());
            }

            let content = value
                .pointer("/message/content")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();

            if content.is_empty() {
                return Err("Ollama returned an empty response.".into());
            }

            Ok(LocalChatResponse {
                provider: "ollama".into(),
                model: request.model,
                content,
                thinking: value
                    .pointer("/message/thinking")
                    .and_then(Value::as_str)
                    .map(ToOwned::to_owned),
                elapsed_ms: started.elapsed().as_millis(),
            })
        }
        "llamacpp" => {
            chat_openai_compatible(
                &http,
                "llamacpp",
                &format!("{LLAMA_CPP_BASE}/v1"),
                request,
                started,
            )
            .await
        }
        "openai_local" => {
            let base = configured_openai_base()?
                .ok_or_else(|| format!("{OPENAI_LOCAL_ENV} is not configured."))?;
            chat_openai_compatible(&http, "openai_local", &base, request, started).await
        }
        _ => Err("Unsupported local AI provider.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_explicit_loopback_urls() {
        assert_eq!(
            normalize_loopback_base("http://127.0.0.1:8000/v1/").unwrap(),
            "http://127.0.0.1:8000/v1"
        );
        assert!(normalize_loopback_base("http://localhost:9000/v1").is_ok());
        assert!(normalize_loopback_base("http://[::1]:8000/v1").is_ok());
    }

    #[test]
    fn rejects_remote_or_credentialed_urls() {
        assert!(normalize_loopback_base("https://example.com/v1").is_err());
        assert!(normalize_loopback_base("http://192.168.1.9:8000/v1").is_err());
        assert!(normalize_loopback_base("http://user:secret@127.0.0.1:8000/v1").is_err());
    }
}
