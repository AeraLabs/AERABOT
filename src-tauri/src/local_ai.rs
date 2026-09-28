use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

const OLLAMA_BASE: &str = "http://127.0.0.1:11434";
const LLAMA_CPP_BASE: &str = "http://127.0.0.1:8080";

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

async fn probe_ollama(http: &Client) -> LocalProviderStatus {
    let endpoint = format!("{OLLAMA_BASE}/api/tags");
    match http.get(&endpoint).send().await {
        Ok(response) if response.status().is_success() => {
            let parsed = response.json::<Value>().await;
            match parsed {
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
            }
        }
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

async fn probe_llama_cpp(http: &Client) -> LocalProviderStatus {
    let endpoint = format!("{LLAMA_CPP_BASE}/v1/models");
    match http.get(&endpoint).send().await {
        Ok(response) if response.status().is_success() => {
            let parsed = response.json::<Value>().await;
            match parsed {
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
                        id: "llamacpp".into(),
                        name: "llama.cpp".into(),
                        endpoint: LLAMA_CPP_BASE.into(),
                        available: true,
                        models,
                        error: None,
                    }
                }
                Err(error) => LocalProviderStatus {
                    id: "llamacpp".into(),
                    name: "llama.cpp".into(),
                    endpoint: LLAMA_CPP_BASE.into(),
                    available: true,
                    models: vec![],
                    error: Some(format!("Connected, but model discovery failed: {error}")),
                },
            }
        }
        Ok(response) => LocalProviderStatus {
            id: "llamacpp".into(),
            name: "llama.cpp".into(),
            endpoint: LLAMA_CPP_BASE.into(),
            available: false,
            models: vec![],
            error: Some(format!("HTTP {}", response.status())),
        },
        Err(error) => LocalProviderStatus {
            id: "llamacpp".into(),
            name: "llama.cpp".into(),
            endpoint: LLAMA_CPP_BASE.into(),
            available: false,
            models: vec![],
            error: Some(error.to_string()),
        },
    }
}

pub async fn probe() -> Result<Vec<LocalProviderStatus>, String> {
    let http = client(5)?;
    let ollama = probe_ollama(&http).await;
    let llama_cpp = probe_llama_cpp(&http).await;
    Ok(vec![ollama, llama_cpp])
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
            let response = http
                .post(format!("{LLAMA_CPP_BASE}/v1/chat/completions"))
                .json(&json!({
                    "model": request.model,
                    "messages": request.messages,
                    "temperature": 0.25,
                    "max_tokens": 700,
                    "stream": false
                }))
                .send()
                .await
                .map_err(|error| format!("llama.cpp is unavailable: {error}"))?;

            let status = response.status();
            let value = response
                .json::<Value>()
                .await
                .map_err(|error| format!("Invalid llama.cpp response: {error}"))?;

            if !status.is_success() {
                return Err(value
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .unwrap_or("llama.cpp returned an error.")
                    .to_string());
            }

            let content = value
                .pointer("/choices/0/message/content")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();

            if content.is_empty() {
                return Err("llama.cpp returned an empty response.".into());
            }

            Ok(LocalChatResponse {
                provider: "llamacpp".into(),
                model: request.model,
                content,
                thinking: None,
                elapsed_ms: started.elapsed().as_millis(),
            })
        }
        _ => Err("Unsupported local AI provider.".into()),
    }
}
